terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    bucket       = "flagrship-tfstate-288148419880"
    key          = "site/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

# us-east-1 is not optional here: CloudFront only accepts ACM certificates
# issued in us-east-1, whichever region the bucket lives in.
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "flagrship"
      Stack     = "site"
      ManagedBy = "terraform"
    }
  }
}
