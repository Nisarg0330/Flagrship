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
  type    = string
  default = "Nisarg0330/Flagrship"
}

variable "api_cname_target" {
  description = "Where api.<domain> points while the API is hosted off-AWS, e.g. flagrship-api.onrender.com. Set to \"\" when the api stack takes over the record."
  type        = string
  default     = ""
}
