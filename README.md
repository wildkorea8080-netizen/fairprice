# Fairprice

Fairprice is a new web service for monitoring Coupang discounts and sending deal alerts.

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

## Build Steps

Development is intentionally staged. Step 1 initializes the project only. Later steps add layout, database, authentication, product management, alerts, and deployment.

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The stage 10 build is prepared as a deployable MVP demo. See
[`DEPLOYMENT.md`](./DEPLOYMENT.md) for environment variables, Vercel steps, the
health endpoint, and the production readiness gate.

For a HestiaCP cloud server deployment, see
[`HESTIACP_DEPLOYMENT.md`](./HESTIACP_DEPLOYMENT.md). It covers PM2, Nginx
reverse proxy, cron, PostgreSQL, and post-deploy smoke tests.
