# Route 53 becomes authoritative for the domain once the registrar's
# nameservers are pointed at this zone's (output: name_servers). Everything
# else in this stack waits on that, because the certificate validates over DNS.

resource "aws_route53_zone" "main" {
  name = var.domain
}

# One certificate for the apex and www. CloudFront requires it in us-east-1,
# which is where this provider lives.
resource "aws_acm_certificate" "site" {
  domain_name               = var.domain
  subject_alternative_names = ["www.${var.domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.site.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "site" {
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]

  timeouts {
    create = "60m" # covers the time it takes you to update the registrar
  }
}

# flagrship.dev and www.flagrship.dev -> CloudFront.
resource "aws_route53_record" "apex" {
  for_each = toset(["A", "AAAA"])

  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain
  type    = each.key

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  for_each = toset(["A", "AAAA"])

  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain}"
  type    = each.key

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# api.flagrship.dev -> wherever the API runs off-AWS (Render, for now). When
# the api stack is applied it owns this name instead: set api_cname_target to
# "" here, apply, then apply ../api.
resource "aws_route53_record" "api" {
  count = var.api_cname_target != "" ? 1 : 0

  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain}"
  type    = "CNAME"
  ttl     = 300
  records = [var.api_cname_target]
}
