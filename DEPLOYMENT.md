# Fairprice Deployment

## Current Release Level

The current build is a deployable MVP demo with a PostgreSQL-backed Coupang
collection and notification pipeline.

- Authentication uses a signed HTTP-only cookie session.
- Coupang Partners API collection stores products and price history in PostgreSQL.
- Keyword alert rules are mirrored into PostgreSQL for cron evaluation.
- Email delivery can use Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set.
- Admin product, collection, notification, click, and diagnostic pages are available.

Do not treat demo mode as a production account system.

## Vercel Deployment

1. Push the repository to a private Git provider repository.
2. Import the repository in Vercel as a Next.js project.
3. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS domain.
4. Set `FAIRPRICE_DEPLOYMENT_MODE=demo`.
5. Set `FAIRPRICE_ADMIN_EMAIL` to the demo administrator email.
6. Deploy and verify `/api/health`, `/robots.txt`, and `/sitemap.xml`.

The existing `build` and `start` scripts also support a standard Node.js host.

## HestiaCP / VPS Deployment

For a HestiaCP-managed cloud server, use HestiaCP for the domain, SSL, and Nginx
reverse proxy, then run the Next.js app with PM2 on `127.0.0.1:3000`.
When `FAIRPRICE_DEPLOYMENT_MODE=production`, the app also sends
`Strict-Transport-Security` for HTTPS hardening. Enable it only after the final
domain is serving valid HTTPS.

See [`HESTIACP_DEPLOYMENT.md`](./HESTIACP_DEPLOYMENT.md) for the full checklist,
PM2 setup, Nginx proxy example, cron commands, and post-deploy smoke tests.

## Health Monitoring

`/api/health` reports database, Coupang Partners, cron secret, legal contact,
email, automation, and price tracking status. Use `checks.productionServices`
for the deployment readiness summary, `checks.automationFresh` to monitor
whether the cron pipeline completed successfully within the freshness window,
and `checks.priceTrackingFresh` to detect stale product price collection. The
`automation` and `priceTracking` objects include the latest timestamps and
elapsed minutes for external monitors.

## Search Engine Indexing

Set `NEXT_PUBLIC_APP_URL` to the public HTTPS domain before submitting the site
to search engines. Product pages expose canonical URLs, Open Graph metadata,
and Product JSON-LD. `/sitemap.xml` includes active tracked products from the
database and `/robots.txt` allows public product/category/deal pages.

For ownership verification, set `NAVER_SITE_VERIFICATION` from Naver Search
Advisor and `GOOGLE_SITE_VERIFICATION` from Google Search Console. After
deployment, submit:

```text
https://your-domain.com/sitemap.xml
```

## Local Docker Database

Run `npm run db:up` to start PostgreSQL 16 on `localhost:5432`, then run
`npm run db:migrate` to apply the Prisma schema. `npm run db:down` stops the
container without deleting the named database volume.

## Production Gate

Before changing `FAIRPRICE_DEPLOYMENT_MODE` to `production`:

1. Connect PostgreSQL and run Prisma migrations.
2. Replace all local secrets with production-only values.
3. Set `FAIRPRICE_OPERATOR_NAME` and `FAIRPRICE_CONTACT_EMAIL` for the terms
   and privacy pages.
4. Connect Resend or another transactional email provider.
5. Verify Coupang Partners API collection and approved affiliate disclosure.
6. Register scheduled product collection, alert evaluation, and notification sending.
7. Add rate limiting, monitoring, backups, and a production privacy policy.
8. Run `npm run verify:deploy -- --baseUrl=https://your-domain.com --requireHsts=true` against the deployed domain.
9. Submit `sitemap.xml` to Naver Search Advisor and Google Search Console.

`verify:deploy` performs the production environment check, TypeScript check,
ESLint, production build, smoke test, and `/api/health` readiness summary. For a
quick server-only check after a configuration change, use:

```bash
npm run verify:deploy -- --skipBuild=true --baseUrl=https://your-domain.com
```

For local development where email delivery is intentionally not configured, use
`--skipReadiness=true` to run the structural checks without failing on
`checks.productionServices`.

After switching `FAIRPRICE_DEPLOYMENT_MODE=production`, include
`--requireHsts=true` so the smoke test verifies the deployed HTTPS response
contains `Strict-Transport-Security`.

## Price Collection Job

The protected endpoint `/api/cron/collect-products` collects the comma-separated
keywords in `COUPANG_COLLECTION_KEYWORDS` until database collection rules are
created. Once rules exist in PostgreSQL, the job uses only active database
rules and respects each rule's collection limit. Send `Authorization: Bearer
<CRON_SECRET>` when invoking it from a scheduler.

## Scheduled Automation

Use the integrated endpoint for normal operation:

```text
GET /api/cron/run-pipeline?batchSize=5&clickKeywordLimit=10&sendDryRun=false
Authorization: Bearer <CRON_SECRET>
```

The pipeline runs these steps in order:

1. `discover`: refresh Coupang candidates at most every six hours and automatically
   promote up to three trusted candidates per run, capped at 100 active rules.
2. `click-keywords`: create keyword candidates from affiliate click signals.
3. `collect`: enqueue active collection rules and process pending collection jobs.
4. `alerts`: evaluate user alert rules against tracked products.
5. `send`: send pending notifications through Resend, or dry-run when email is not configured.

Recommended scheduler setup:

```cron
*/30 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://your-domain.com/api/cron/run-pipeline?batchSize=5&clickKeywordLimit=10&sendDryRun=false"
*/10 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://your-domain.com/api/cron/run-pipeline?steps=alerts,send"
0 */6 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://your-domain.com/api/cron/run-pipeline?steps=discover,click-keywords&clickKeywordLimit=10"
```

For Vercel Cron, create `vercel.json` and point each schedule at the same URLs.
Vercel Cron can provide an authorization header through project settings or a
small proxy job. Keep `CRON_SECRET` private and rotate it if it is exposed.

Local or self-hosted Node execution can use the included helper script:

```bash
npm run cron:pipeline
npm run cron:alerts
npm run cron:collect
npm run cron:discover
npm run cron:clicks
```

The helper reads `CRON_SECRET` from `.env.local` or the process environment and
calls `/api/cron/run-pipeline`. Override options when needed:

```bash
node scripts/run-cron-pipeline.mjs --baseUrl=https://your-domain.com --steps=alerts,send --sendDryRun=false
node scripts/run-cron-pipeline.mjs --baseUrl=https://your-domain.com --steps=click-keywords --clickKeywordLimit=20
```

## Email Verification

Set both `RESEND_API_KEY` and `EMAIL_FROM`. `/api/health` reports email as
ready only when both values are present. After deployment, open
`/admin/notifications` and send a test email to the administrator account before
turning off dry-run notification sending.
