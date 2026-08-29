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

## Current Production Deployment (Coolify)

`https://fairprice.kr` runs on a self-hosted Coolify instance (v4.3.11) at
`115.68.222.86`, backed by Docker. Images are built from the `Dockerfile` in the
repository root - not Nixpacks, whose pinned Node is older than Prisma 7
requires. The release flow is:

1. Verify locally: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
2. Commit and push to GitHub `main`.
3. In Coolify, press **Force Redeploy** on the Fairprice application.
4. Check `https://fairprice.kr/api/health` for the readiness summary.

Coolify supplies the environment variables listed in `.env.production.example`.
PostgreSQL runs as a separate Coolify service; `npm start` applies
`prisma migrate deploy` before the server starts, so schema changes ship with
the same redeploy.

Collection runs as a Coolify **Scheduled Task** on the application resource:

```text
Name       cron-pipeline
Command    npm run cron:pipeline
Frequency  */30 * * * *
```

Prefer a Coolify scheduled task over a host `crontab` entry. Coolify recreates
the application container on every deploy, so a `docker exec <container-name>`
line in `crontab` stops working silently after the next release.

To move the service to a different VPS, follow
[`docs/SERVER_MIGRATION.md`](./docs/SERVER_MIGRATION.md). It covers the data
dump, restore ordering, DNS cutover, cron re-registration, and rollback.

The sections below describe alternative hosts and remain valid for reference.

## Vercel Deployment (alternative)

1. Push the repository to a private Git provider repository.
2. Import the repository in Vercel as a Next.js project.
3. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS domain.
4. Set `FAIRPRICE_DEPLOYMENT_MODE=demo`.
5. Set `FAIRPRICE_ADMIN_EMAIL` to the demo administrator email.
6. Deploy and verify `/api/health`, `/robots.txt`, and `/sitemap.xml`.

The existing `build` and `start` scripts also support a standard Node.js host.

## HestiaCP / VPS Deployment (alternative)

For a HestiaCP-managed cloud server, use HestiaCP for the domain, SSL, and Nginx
reverse proxy, then run the Next.js app with PM2 on `127.0.0.1:3000`.
When `FAIRPRICE_DEPLOYMENT_MODE=production`, the app also sends
`Strict-Transport-Security` for HTTPS hardening. Enable it only after the final
domain is serving valid HTTPS.

See [`HESTIACP_DEPLOYMENT.md`](./HESTIACP_DEPLOYMENT.md) for the full checklist,
PM2 setup, Nginx proxy example, cron commands, and post-deploy smoke tests.

## Database Backup and Restore

### Scheduled backups

Back up through the Coolify **PostgreSQL resource**, not a scheduled task on the
application. The application container is recreated on every deploy, so a dump
written inside it is discarded at the next release.

```text
Projects -> production -> fairprice-postgres -> Backups
Database selection  Specific databases
Databases           fairprice
Frequency           0 4 * * *
Timezone            Asia/Seoul
Retention           14
```

**Set the timezone.** Coolify schedules in UTC when the field is left empty, so
`0 4 * * *` would run at 13:00 KST - the middle of the day - instead of the
quiet point in the collection cycle. Either set `Asia/Seoul`, or keep UTC and
write the schedule as `0 19 * * *`.

The database is a few megabytes, so a fortnight of dumps costs almost nothing
and the default timeout is far more than the dump needs.

### Keep a copy off the server

Coolify writes backups to the same disk as the database. That covers a bad
migration or a corrupted container; it does not cover losing the machine. If
the Backups screen offers S3, point it at a bucket. Otherwise pull a copy down
periodically:

```bash
ssh root@<host> 'ls -t /data/coolify/backups/databases/*/* | head -1'
scp root@<host>:<path-from-above> ./backups/
```

`backups/` and `*.dump` are gitignored. A dump contains member emails and
password hashes, so treat a local copy as production data and delete it when
you no longer need it.

### Restore

`scripts/restore-postgres.mjs` refuses to run without an explicit confirmation,
so an accidental invocation prints the plan and stops:

```bash
npm run db:restore -- --file=./backups/<file>.dump
npm run db:restore -- --file=./backups/<file>.dump --confirm=RESTORE
```

Restoring into a database that already holds data needs `--clean=true`, which
drops the existing objects first. Read that flag twice before using it against
production.

To restore straight into the server's container instead:

```bash
docker cp <file>.dump <postgres-container>:/tmp/restore.dump
docker exec <postgres-container> pg_restore --no-owner --no-acl   -U fairprice -d fairprice /tmp/restore.dump
docker exec <postgres-container> rm /tmp/restore.dump
```

Never add `-t` to `docker exec` around a dump or a restore. It allocates a TTY,
which rewrites newlines and silently corrupts the archive.

### Verify the backup is real

A backup nobody has restored is a guess. After the first scheduled run, confirm
the file exists and that its row counts match production:

```bash
find /data/coolify/backups -type f \( -name '*.gz' -o -name '*.dump' \) | head
```

```sql
select (select count(*) from products) products,
       (select count(*) from product_price_histories) histories,
       (select count(*) from price_observations) observations,
       (select count(*) from users) users,
       (select count(*) from _prisma_migrations) migrations;
```

[`docs/SERVER_MIGRATION.md`](./docs/SERVER_MIGRATION.md) records the counts from
the 2026-08-27 migration and walks through a full dump-and-restore against a
second machine, which doubles as the restore drill.

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
3. `collect`: enqueue active collection rules (discovery, every six hours per
   rule) and process pending collection jobs.
4. `refresh`: re-observe the highest-priority tracked products that are due,
   up to `refreshBudget` per run (default 25). This is what builds per-product
   price history depth; keyword jobs only discover.
5. `alerts`: evaluate user alert rules against tracked products.
6. `send`: send pending notifications through Resend, or dry-run when email is not configured.

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
