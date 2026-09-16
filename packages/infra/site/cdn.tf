# Private S3 bucket, readable only by this CloudFront distribution via Origin
# Access Control. The bucket has no website endpoint and no public policy.

resource "aws_s3_bucket" "site" {
  bucket        = "${var.project}-site-${var.domain}"
  force_destroy = true # it only ever holds a build output
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.project}-site"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CloudFrontRead"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.site.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.site.arn }
      }
    }]
  })
}

# Next.js static export writes docs/cli/index.html. A request for /docs/cli or
# /docs/cli/ must become /docs/cli/index.html before it reaches S3, which has
# no notion of a directory index. Runs at the edge on every request; the free
# tier is 2M invocations a month.
resource "aws_cloudfront_function" "index_rewrite" {
  name    = "${var.project}-site-index-rewrite"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var req = event.request;
      var uri = req.uri;
      if (uri.endsWith('/')) {
        req.uri = uri + 'index.html';
      } else if (!uri.includes('.')) {
        req.uri = uri + '/index.html';
      }
      return req;
    }
  JS
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.domain} landing and docs"
  default_root_object = "index.html"
  aliases             = [var.domain, "www.${var.domain}"]
  price_class         = "PriceClass_100" # NA + EU edges; add more when there are users elsewhere
  http_version        = "http2and3"

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS-managed "CachingOptimized": long TTLs, honours the ETags S3 sends.
    # Deploys invalidate /* so a new build is visible within a minute.
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.index_rewrite.arn
    }
  }

  # S3 answers 403 for a missing key behind OAC; show the site's own 404 page.
  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 60
  }
  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 60
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
