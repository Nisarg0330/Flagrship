resource "random_password" "db" {
  length  = 32
  special = false # keeps the connection URL free of characters that need escaping
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db"
  subnet_ids = aws_subnet.public[*].id
}

resource "aws_db_instance" "main" {
  identifier = "${var.project}-db"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100 # grows on demand up to here; you pay for what is used
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "flagrship"
  username = "flagrship"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period = 7
  backup_window           = "07:00-08:00" # 03:00 Toronto
  maintenance_window      = "Sun:08:00-Sun:09:00"

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = !var.deletion_protection
  final_snapshot_identifier = var.deletion_protection ? "${var.project}-db-final" : null

  # Free on t4g.micro is false; $2/mo elsewhere. Off until a query is slow.
  performance_insights_enabled = false

  tags = { Name = "${var.project}-db" }
}

# The API reads DATABASE_URL from Secrets Manager at task start. Never an env
# var in the task definition, which would show in the console and in `describe`.
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.project}/api/DATABASE_URL"
  recovery_window_in_days = var.deletion_protection ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://${aws_db_instance.main.username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${aws_db_instance.main.db_name}?schema=public"
}
