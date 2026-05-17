# Lift

Shop management app for 1–3 bay independent auto repair shops. The wedge is AI-handled customer SMS so the owner-operator can stay in the bay.

This is a pnpm-workspaces monorepo deployed via SST v3 to AWS.

## Layout

```
lift/
├─ apps/
│  ├─ web/          # React + Vite + Mantine PWA (authenticated shop app)
│  ├─ marketing/    # Pre-rendered landing page (lift.com)
│  └─ api/          # AWS Lambda functions (auth, ROs, messaging, payments, …)
├─ packages/
│  └─ shared/       # Mongoose models, Zod DTOs, Bedrock prompt templates
├─ sst.config.ts    # SST stack definition
├─ pnpm-workspace.yaml
└─ .env.example
```

## Prereqs

- Node ≥ 20
- pnpm ≥ 9 (`corepack enable && corepack prepare pnpm@latest --activate`)
- AWS account with:
  - MongoDB Atlas cluster (URI in `MONGODB_URI`)
  - AWS End User Messaging SMS approval (10DLC or toll-free phone pool)
  - Bedrock model access for `anthropic.claude-sonnet-4-6` and `anthropic.claude-haiku-4-5`
  - SES sender identity verified
- Stripe account in test mode

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm dev            # runs `sst dev` (live Lambda + local web)
```

In separate terminals you can run the web and marketing dev servers without SST:

```bash
pnpm dev:web
pnpm dev:marketing
```

## Deploying

```bash
pnpm deploy:dev    # stage = dev
pnpm deploy:prod   # stage = prod
```

## See also

The full v1 build plan lives in [`docs/PLAN.md`](docs/PLAN.md) (mirrored from the planning session).
