# infra

Two independent Terraform stacks, applied in this order:

| Stack | What | Cost | Status |
|---|---|---|---|
| `site/` | Route 53 zone for `flagrship.dev`, ACM cert, S3 + CloudFront for the landing and docs, `api.` CNAME → Render, GitHub OIDC | **~$0.50/mo** (the zone; CloudFront's 1 TB free tier is permanent) | apply now |
| `api/` | VPC, RDS, ECS Fargate, ALB, alarms, deploy role — the TRD §10 stack | ~$50/mo | dormant; apply when the API moves off Render |

While the API runs on Render's free tier, only `site/` is applied. The `api/`
stack is validated and planned; it reads the zone and OIDC provider from
`site/` and takes over the `api.` record when its time comes.

## First-time setup

**0. Billing alerts.** AWS console → Billing → Billing preferences → tick
*Receive Billing Alerts*. Free, and the only way a surprise bill emails you.

**1. State bucket.** Once, for both stacks.

```powershell
cd packages\infra
.\bootstrap.ps1
```

**2. The zone first**, so you can delegate the domain while the rest builds.

```powershell
cd site
terraform init
terraform apply -target=aws_route53_zone.main
terraform output name_servers
```

**3. At your registrar**, replace the nameservers for `flagrship.dev` with the
four printed. Minutes, occasionally an hour.

**4. The API on Render**, so the `api.` record has somewhere to point.

- Neon (neon.tech) → new project → copy the connection string, add `?sslmode=require`
- Render → New → Blueprint → this repo → it reads `render.yaml` → paste the Neon URL as `DATABASE_URL`
- Wait for the first deploy (migrations run on boot), then Render → the service → Settings → Custom Domains → add `api.flagrship.dev`. Render shows a hostname like `flagrship-api.onrender.com`.

**5. Everything else in `site/`.**

```powershell
terraform apply -var="api_cname_target=flagrship-api.onrender.com"
```

Certificate validation blocks until the delegated DNS answers. Then:

```powershell
terraform output
```

**6. GitHub.** Repo → Settings → Secrets and variables → Actions:

| Kind | Name | From |
|---|---|---|
| Secret | `AWS_SITE_DEPLOY_ROLE_ARN` | `github_site_deploy_role_arn` |
| Variable | `SITE_BUCKET` | `site_bucket` |
| Variable | `CLOUDFRONT_DISTRIBUTION_ID` | `cloudfront_distribution_id` |

The *Deploy Site* workflow runs on the next push to `packages/landing/`, or
from Actions → Run workflow. About two minutes later:

```
https://flagrship.dev
https://flagrship.dev/docs
https://api.flagrship.dev/health
```

**7. Seed the Neon database.** From your machine, once:

```powershell
$env:DATABASE_URL = "<neon url>?sslmode=require"
npm run db:seed --workspace=@flagrship/api
```

Copy the printed keys. Those are the ones real users' keys will come from
(`POST /keys` with the admin key).

Put stable values in `terraform.tfvars` (gitignored) so you stop passing `-var`:

```hcl
api_cname_target = "flagrship-api.onrender.com"
```

## Day to day

| I want to | Do |
|---|---|
| Deploy the site | push to `packages/landing/` on main; or Actions → Deploy Site |
| Deploy the API | push to main — Render auto-deploys from `render.yaml` |
| Change DNS | edit `site/dns.tf`, `terraform apply` |
| Move the API to AWS | see below |

## Moving the API to AWS later

1. In `site/`: `api_cname_target = ""`, apply. The `api.` record is released.
2. In `api/`: `terraform init`, `terraform apply -var="alarm_email=…"`. Creates the ALB and claims `api.` as an alias.
3. Migrate the data: `pg_dump` from Neon, `pg_restore` into RDS.
4. Add `AWS_DEPLOY_ROLE_ARN` to GitHub, run *Deploy API*.
5. Delete the Render service.

`api/README` details are in that stack's variable descriptions and the
"before real customers" flags: `deletion_protection`, `db_multi_az`,
`desired_count = 2`.

## What is deliberately not here

- **Private subnets / NAT** in `api/`. The task's security group admits only the ALB.
- **Redis wired to the API.** `redis_enabled = false`; trigger in `EXECUTION-PLAN.md`.
- **A CDN for the API.** TRD §10 says API routes are never cached at the edge.
