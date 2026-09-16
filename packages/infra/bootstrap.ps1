# Creates the S3 bucket that holds Terraform state. Run once, before the first
# `terraform init`. Idempotent: safe to re-run.
#
#   .\bootstrap.ps1
#
# Written for Windows PowerShell 5.1, which turns any stderr line from a native
# command into a terminating error under ErrorActionPreference = Stop. So: no
# head-bucket (404s on stderr), no stderr redirects, no escaped-JSON arguments.

$ErrorActionPreference = 'Stop'
$bucket = 'flagrship-tfstate-288148419880'
$region = 'us-east-1'

$account = aws sts get-caller-identity --query Account --output text
if ($account -ne '288148419880') { throw "aws is configured for account '$account', expected 288148419880" }

# list-buckets returns an empty string for a missing bucket; nothing on stderr.
$found = aws s3api list-buckets --query "Buckets[?Name=='$bucket'].Name" --output text
if ($found -eq $bucket) {
  Write-Host "bucket $bucket already exists"
} else {
  aws s3api create-bucket --bucket $bucket --region $region | Out-Null
  Write-Host "created $bucket"
}

# Versioning: every state write is recoverable. Encryption: the state holds
# the database password. Public access block: belt and braces.
aws s3api put-bucket-versioning --bucket $bucket --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket $bucket --server-side-encryption-configuration 'Rules=[{ApplyServerSideEncryptionByDefault={SSEAlgorithm=AES256}}]'
aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

Write-Host "ready. next: cd site; terraform init"
