# Provisioned only when redis_enabled = true. The API does not read from Redis
# yet - EXECUTION-PLAN.md has the trigger. Written now so it is one variable
# flip later, not a design session. count = 0 costs nothing.

resource "aws_security_group" "redis" {
  count = var.redis_enabled ? 1 : 0

  name        = "${var.project}-redis"
  description = "Only the API may reach Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }
}

resource "aws_elasticache_subnet_group" "main" {
  count = var.redis_enabled ? 1 : 0

  name       = "${var.project}-redis"
  subnet_ids = aws_subnet.public[*].id
}

resource "aws_elasticache_cluster" "main" {
  count = var.redis_enabled ? 1 : 0

  cluster_id           = "${var.project}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main[0].name
  security_group_ids = [aws_security_group.redis[0].id]
}
