variable "region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "flagrship"
}

variable "domain" {
  description = "Apex domain. A Route 53 hosted zone is created for it; delegate the registrar's nameservers to the zone's."
  type        = string
  default     = "flagrship.dev"
}

variable "api_subdomain" {
  type    = string
  default = "api"
}

variable "github_repo" {
  description = "owner@owner_id/name@repo_id. GitHub OIDC `sub` claims carry the numeric IDs, which survive renames; the trust policy pins them. Find yours: curl -s https://api.github.com/repos/OWNER/NAME | jq '{owner_id: .owner.id, repo_id: .id}'"
  type        = string
  default     = "Nisarg0330@85939030/Flagrship@1371654175"
}

variable "alarm_email" {
  description = "Where billing and 5xx alarms go. AWS sends a confirmation email you must click."
  type        = string
}

# ── sizing ─────────────────────────────────────────────────────────────────
# Defaults are the cheapest configuration that is still a real, always-on
# deployment. Roughly $50/month at us-east-1 on-demand; the new-account free
# tier credit covers the first stretch. See README for what each line costs.

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_multi_az" {
  description = "Synchronous standby in a second AZ. Doubles the database cost. TRD wants it for production; off until there are customers."
  type        = bool
  default     = false
}

variable "task_cpu" {
  description = "Fargate CPU units. 256 = 0.25 vCPU."
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Fargate memory in MiB."
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "API tasks. 1 for beta; 2 for no-downtime deploys."
  type        = number
  default     = 1
}

variable "image_tag" {
  description = "Initial image tag for the task definition. The deploy workflow registers new revisions with commit-SHA tags after this."
  type        = string
  default     = "latest"
}

variable "redis_enabled" {
  description = "Provision ElastiCache. The API does not read from Redis yet (see EXECUTION-PLAN.md), so this stays off until it does."
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Guard RDS and the ALB against `terraform destroy`. Off while this is a staging stack you may tear down; on before real customers."
  type        = bool
  default     = false
}

variable "billing_alarm_usd" {
  description = "Estimated monthly charges that trigger an email."
  type        = number
  default     = 25
}
