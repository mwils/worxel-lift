# Build Instructions — Lift

> **Approval**: Self-approved by orchestrator on 2026-05-24T21:50:00Z.
> **Source**: `CLAUDE.md` §Commands, `docs/PLAN.md` §Verification plan.

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node | 20 | `nvm install 20 && nvm use` (project `.nvmrc` is set) |
| pnpm | 9.12.0 | `corepack enable && corepack prepare pnpm@9.12.0 --activate` |
| SST CLI | bundled with project | installed via `pnpm install` |
| AWS CLI | latest | `brew install awscli` |
| AWS credentials | configured profile | `aws configure --profile lift` and set `AWS_PROFILE=lift` |

**One-time per stage** — set every secret (see `CLAUDE.md` §Deploy):

```bash
sst secret set MongodbUri           "mongodb+srv://..."  --stage dev
sst secret set JwtSecret            "..."                --stage dev
sst secret set StripeSecretKey      "sk_test_..."        --stage dev
sst secret set StripePublishableKey "pk_test_..."        --stage dev
sst secret set StripeWebhookSecret  "whsec_..."          --stage dev
sst secret set StripePriceLift79    "price_..."          --stage dev
sst secret set SesFromEmail         "lift@worxel.com"    --stage dev
sst secret set SmsPoolId            "..."                --stage dev
```

## Install dependencies

```bash
nvm use
corepack enable && corepack prepare pnpm@9.12.0 --activate
pnpm install
```

## Build everything (typecheck + bundle)

```bash
pnpm -r typecheck      # All workspaces — TS strict, must pass
pnpm -r build          # All workspaces — bundles via Vite + esbuild
```

## Per-workspace build

```bash
pnpm --filter @lift/shared build      # Type declarations + ESM out
pnpm --filter @lift/web build         # Vite production build to dist/
pnpm --filter @lift/marketing build   # Vite production build to dist/
pnpm --filter @lift/api build         # esbuild bundles per Lambda (driven by SST)
```

## Run locally

```bash
pnpm --filter @lift/web dev           # Vite dev :5173
pnpm --filter @lift/marketing dev     # Vite dev :5174
pnpm dev                              # sst dev — live Lambdas + bound resources (recommended)
```

`sst dev` is the canonical local-dev entry point — it spins live Lambdas with hot reload and binds them to real secrets + Mongo.

## Deploy

```bash
pnpm deploy:dev                       # sst deploy --stage dev
pnpm deploy:prod                      # sst deploy --stage prod
```

**Prod removal policy is `retain`** — destroying the stack does not delete the photos S3 bucket or production data.

## Build outputs

| Workspace | Output |
|---|---|
| `apps/api` | esbuild bundles per Lambda; uploaded by SST |
| `apps/web` | `apps/web/dist/` — static assets, deployed by SST to CloudFront |
| `apps/marketing` | `apps/marketing/dist/` — static assets, deployed by SST to CloudFront |
| `packages/shared` | ESM out + .d.ts |

## Known gotchas (must-have knowledge before building)

- **Node 20 mandatory**. Node 18 breaks `vite-plugin-pwa` and Bedrock SDK.
- **`.npmrc` must contain** `public-hoist-pattern[]=*workbox*` — already present.
- **Bedrock model ID must be inference-profile-prefixed** (e.g., `us.anthropic.claude-haiku-4-5`). Bare `anthropic.claude-…` IDs fail with "Invocation … with on-demand throughput isn't supported."
- **Mongoose model overwrite errors** in dev — handled by `mongoose.models.X || mongoose.model(...)` guard in every model file.
- **MOCK_SMS=1** is enabled in `sst.config.ts` commonEnv until AWS 10DLC campaign clears review. Remove only when ready to send real SMS.
