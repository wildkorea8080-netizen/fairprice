# Fairprice

Fairprice is a web service for monitoring Coupang prices, detecting deals, and
sending deal alerts. It is live at [https://fairprice.kr](https://fairprice.kr).

## Documentation

Read these before changing anything:

- [`docs/PROJECT_STATE.md`](./docs/PROJECT_STATE.md) - current state, architecture map, next priorities.
- [`docs/DEAL_ENGINE_DIRECTIVE.md`](./docs/DEAL_ENGINE_DIRECTIVE.md) - non-negotiable architecture principles.
- [`docs/IMPLEMENTATION_AUDIT.md`](./docs/IMPLEMENTATION_AUDIT.md) - domain boundaries and delivery gates.
- [`docs/deal-engine/`](./docs/deal-engine/) - Deal Score, Deal Detection, and price history policy.
- [`AGENTS.md`](./AGENTS.md) - conventions and verification gates for coding agents.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Coolify release flow, cron setup, production gate.
- [`docs/SERVER_MIGRATION.md`](./docs/SERVER_MIGRATION.md) - runbook for moving the service to a new VPS.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- ESLint
- PostgreSQL
- Prisma
- npm

## Local Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` starts the local development server.
- `npm run build` creates a production build.
- `npm run start` starts the production server.
- `npm run lint` runs ESLint.
- `npm run test:smoke` verifies key public pages, SEO files, affiliate redirects,
  admin protection, and cron API auth guards against a running server.
- `npm test` runs every `scripts/test-*.mjs` suite. It discovers them, so a new
  test file is covered without registering anything. Pass part of a name to run
  a subset: `npm test alert`.
- `npm run test:deal-engine` runs the Deal Score and Deal Detection unit tests.
- `npm run test:alert-delivery-policy` runs the alert dedupe and cooldown tests.
- `npm run verify:deploy` runs the production env check, type check, lint,
  production build, and smoke test.
- `npm run check:env` checks production environment variables without printing
  secret values.
- `npm run email:check` verifies local Resend email settings without printing
  secret values.
- `npm run email:test -- --to=you@example.com` sends a Resend test email.
- `npm run readiness:check` summarizes `/api/health` readiness checks.
- `npm run secrets:generate` generates production-ready admin and cron secrets.
- `npm run cron:pipeline` calls the integrated collection and notification pipeline.
- `npm run cron:alerts` evaluates and dry-runs alert delivery.
- `npm run cron:collect` processes product collection jobs.
- `npm run cron:discover` refreshes Coupang and click-based keyword candidates.
- `npm run cron:clicks` creates keyword candidates from affiliate click signals.
- `npm run db:backup` creates a PostgreSQL custom-format backup.
- `npm run db:restore` dry-runs a PostgreSQL restore unless
  `-- --confirm=RESTORE` is provided.
- `npm run db:check` verifies the configured PostgreSQL connection.
- `npx prisma validate` validates the Prisma schema.
- `npx prisma generate` generates Prisma Client.

## Database

The project is prepared for PostgreSQL through Prisma 7. Copy `.env.example` to
`.env.local` and replace `DATABASE_URL` with the local or production Postgres
connection string before running migrations. The database URL is configured in
`prisma.config.ts`.

For local development, PostgreSQL 16 runs through Docker Compose:

```bash
npm run db:up
npm run db:check
npm run db:migrate
```

The named volume `fairprice_postgres_data` preserves local price history when
the container restarts.

Planned MVP tables are defined in `prisma/schema.prisma`:

- users
- categories
- products
- product_price_histories
- user_favorite_products
- alert_rules
- notification_logs
- admin_product_notes
- click_logs

## Authentication

The app uses an HTTP-only signed cookie session for login, signup, logout, and
admin route protection. Use `FAIRPRICE_ADMIN_EMAIL` and
`FAIRPRICE_ADMIN_PASSWORD` in `.env.local` to control the local administrator
account. Replace `FAIRPRICE_AUTH_SECRET` before any public deployment.

## User Preferences

Favorite products, keyword alert rules, product alert rules, notification logs,
click logs, and price history are persisted in PostgreSQL.

## Notification Outbox

Matched alert rules create PostgreSQL `notification_logs` records. The protected
`/api/cron/send-notifications` endpoint sends pending notifications through
Resend when `RESEND_API_KEY` and `EMAIL_FROM` are configured. Without email
configuration it runs as a dry-run and leaves pending notifications untouched.
Use `/admin/notifications` to verify the masked sender address and send a test
email before enabling real notification delivery.

For a quick local configuration check, run:

```bash
npm run email:check
npm run email:test -- --to=you@example.com
```

## Scheduled Automation

The protected `/api/cron/run-pipeline` endpoint connects the operational flow:

```text
discover keywords -> create click keyword candidates -> collect products -> evaluate alerts -> send notifications
```

Register this endpoint with a server cron, Vercel Cron, or another scheduler:

```text
/api/cron/run-pipeline?batchSize=5&clickKeywordLimit=10&sendDryRun=false
```

Every cron request must include `Authorization: Bearer <CRON_SECRET>`.
`/api/health` includes `checks.automationFresh` and an `automation` object so an
external monitor can detect when the app is reachable but the cron pipeline has
not completed successfully within the freshness window.

For a local readiness summary, run:

```bash
npm run readiness:check
```

## Deal Engine

Price collection, statistics, scoring, and deal detection live in
`src/modules/deal-engine` and never depend on a specific marketplace. Coupang
support is an adapter in `src/modules/providers/coupang`. Deal Score and Deal
Detection are deterministic - they never call an LLM.

## Deployment

Production runs on Coolify and redeploys from GitHub `main`. See
[`DEPLOYMENT.md`](./DEPLOYMENT.md) for the release flow, environment variables,
cron schedules, health endpoint, and the production readiness gate.
[`HESTIACP_DEPLOYMENT.md`](./HESTIACP_DEPLOYMENT.md) documents the earlier
HestiaCP/PM2 setup and is kept for reference.
