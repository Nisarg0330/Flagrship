variable "project" {
  type    = string
  default = "flagrship"
}

variable "domain" {
  description = "Apex domain. The hosted zone for it is created here; delegate the registrar's nameservers to output name_servers."
  type        = string
  default     = "flagrship.dev"
}

variable "github_repo" {
  description = "owner@owner_id/name@repo_id. GitHub OIDC `sub` claims carry the numeric IDs, which survive renames; the trust policy pins them. Find yours: curl -s https://api.github.com/repos/OWNER/NAME | jq '{owner_id: .owner.id, repo_id: .id}'"
  type        = string
  default     = "Nisarg0330@85939030/Flagrship@1371654175"
}

variable "api_cname_target" {
  description = "Where api.<domain> points while the API is hosted off-AWS, e.g. flagrship-api.onrender.com. Set to \"\" when the api stack takes over the record."
  type        = string
  default     = ""
}
