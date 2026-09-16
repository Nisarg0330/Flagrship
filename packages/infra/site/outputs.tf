output "name_servers" {
  description = "Set these as the nameservers for the domain at your registrar."
  value       = aws_route53_zone.main.name_servers
}

output "site_url" {
  value = "https://${var.domain}"
}

output "cloudfront_domain" {
  description = "Reachable before DNS is delegated (the certificate will not match, but the files will serve)."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_distribution_id" {
  description = "Add as the CLOUDFRONT_DISTRIBUTION_ID repository variable on GitHub."
  value       = aws_cloudfront_distribution.site.id
}

output "site_bucket" {
  description = "Add as the SITE_BUCKET repository variable on GitHub."
  value       = aws_s3_bucket.site.bucket
}

output "github_site_deploy_role_arn" {
  description = "Add as the AWS_SITE_DEPLOY_ROLE_ARN repository secret on GitHub."
  value       = aws_iam_role.github_site_deploy.arn
}
