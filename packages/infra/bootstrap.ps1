# Creates the S3 bucket that holds Terraform state. Run once, before the first
# `terraform init`. Idempotent: safe to re-run.
#
#   .\bootstrap.ps1

$ErrorActionPreference = 'Stop'
$bucket = 'flagrship-tfstate-288148419880'
$region = 'us-east-1'

$exists = aws s3api head-bucket --bucket $bucket 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "bucket $bucket already exists"
} else {
  aws s3api create-bucket --bucket $bucket --region $region | Out-Null
  Write-Host "created $bucket"
}

# Versioning: every state write is recoverable. Encryption: the state holds
# the database password. Public access block: belt and braces.
aws s3api put-bucket-versioning --bucket $bucket --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket $bucket --server-side-encryption-configuration '{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"AES256\"}}]}'
aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

Write-Host "ready. next: terraform init"
