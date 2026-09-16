terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State lives in S3, never in git: it holds resource IDs and the database
  # password. `use_lockfile` is S3-native locking (Terraform >= 1.10), so no
  # DynamoDB table is needed. The bucket is created once by bootstrap.ps1.
  backend "s3" {
    bucket       = "flagrship-tfstate-288148419880"
    key          = "api/terraform.tfstate" # site stack: site/terraform.tfstate
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "flagrship"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}
