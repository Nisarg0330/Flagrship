output "api_url" {
  value = "https://${var.api_subdomain}.${var.domain}"
}

output "alb_dns_name" {
  description = "Reachable over plain HTTP before DNS is delegated."
  value       = aws_lb.api.dns_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service" {
  value = aws_ecs_service.api.name
}

output "github_deploy_role_arn" {
  description = "Add as the AWS_DEPLOY_ROLE_ARN repository secret on GitHub."
  value       = aws_iam_role.github_deploy.arn
}

output "db_endpoint" {
  value = aws_db_instance.main.address
}

output "redis_endpoint" {
  value = var.redis_enabled ? aws_elasticache_cluster.main[0].cache_nodes[0].address : null
}
