# Fairprice HestiaCP Deployment

This guide deploys Fairprice as a Node.js app behind the HestiaCP-managed Nginx
site. HestiaCP handles the domain and SSL certificate, while PM2 keeps the
Next.js server running on `127.0.0.1:3000`.

## Target Architecture

```text
https://your-domain.com
  -> HestiaCP Nginx + Let's Encrypt
  -> reverse proxy to 127.0.0.1:3000
  -> Next.js app managed by PM2
  -> PostgreSQL
```

## 1. Server Packages

Install these on the server:

```bash
node -v
npm -v
pm2 -v || npm install -g pm2
psql --version
```

Use an active Node.js LTS version if possible. The project has been tested with
modern Node versions and Next.js 16.

## 2. HestiaCP Domain

1. Add the domain in HestiaCP.
2. Enable Let's Encrypt SSL.
3. Confirm the site opens with HTTPS before adding the reverse proxy.

## 3. PostgreSQL

Create a database and user from HestiaCP or the server shell. The app needs a
PostgreSQL URL like:

```text
postgresql://fairprice_user:password@127.0.0.1:5432/fairprice
```

Keep this value private and put it in `.env.production`.

## 4. Upload Project

Place the project in a stable path, for example:

```bash
/home/admin/web/your-domain.com/fairprice
```

Then install dependencies:

```bash
cd /home/admin/web/your-domain.com/fairprice
npm ci
```

## 5. Production Environment

Copy the example and fill real values:

```bash
cp .env.production.example .env.production
npm run secrets:generate
nano .env.production
```

Required production values:

```text
NEXT_PUBLIC_APP_URL=https://your-domain.com
FAIRPRICE_DEPLOYMENT_MODE=production
DATABASE_URL=postgresql://...
FAIRPRICE_ADMIN_EMAIL=admin@your-domain.com
FAIRPRICE_ADMIN_PASSWORD=...
FAIRPRICE_AUTH_SECRET=...
CRON_SECRET=...
COUPANG_PARTNERS_ACCESS_KEY=...
COUPANG_PARTNERS_SECRET_KEY=...
RESEND_API_KEY=...
EMAIL_FROM=Fairprice <deals@your-domain.com>
```

Do not reuse local development secrets in production.
Use the output from `npm run secrets:generate` for
`FAIRPRICE_ADMIN_PASSWORD`, `FAIRPRICE_AUTH_SECRET`, and `CRON_SECRET`.

## 6. Prisma Migration And Build

Run:

```bash
export $(grep -v '^#' .env.production | xargs)
npm run check:env
npx prisma migrate deploy
npm run build
npm run test:smoke -- --baseUrl=https://your-domain.com
```

Or run the combined verification command:

```bash
npm run verify:deploy -- --envFile=.env.production --baseUrl=https://your-domain.com
```

If the smoke test is run before the reverse proxy is configured, use:

```bash
npm run test:smoke -- --baseUrl=http://127.0.0.1:3000
npm run verify:deploy -- --envFile=.env.production --baseUrl=http://127.0.0.1:3000
```

## 7. PM2

Start the app:

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Useful commands:

```bash
pm2 status
pm2 logs fairprice
pm2 restart fairprice
```

The included PM2 config runs:

```text
next start -H 127.0.0.1 -p 3000
```

## 8. HestiaCP Nginx Reverse Proxy

In the domain's Nginx template or custom config, proxy traffic to the app:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

Reload Nginx after changing the template:

```bash
sudo systemctl reload nginx
```

The exact HestiaCP template path varies by installation. Back up the original
template before editing.

## 9. Cron

Register cron jobs in HestiaCP or with `crontab -e`:

```cron
*/30 * * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/cron/run-pipeline?batchSize=5&clickKeywordLimit=10&sendDryRun=false"
*/10 * * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/cron/run-pipeline?steps=alerts,send"
0 */6 * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-domain.com/api/cron/run-pipeline?steps=discover,click-keywords&clickKeywordLimit=10"
```

## 10. Post-Deploy Checks

Open these URLs:

```text
https://your-domain.com/api/health
https://your-domain.com/admin/test
https://your-domain.com/sitemap.xml
https://your-domain.com/robots.txt
https://your-domain.com/feed.xml
```

Then run:

```bash
npm run test:smoke -- --baseUrl=https://your-domain.com
```

In `/admin/test`, resolve every `fail` item before opening the service publicly.

## 11. Database Backups

Create a manual backup:

```bash
npm run db:backup -- --envFile=.env.production --outputDir=/home/admin/backups/fairprice
```

The script reads `DATABASE_URL` and writes a custom-format `pg_dump` file. Make
sure `pg_dump` is installed on the server.

Recommended daily cron:

```cron
15 3 * * * cd /home/admin/web/your-domain.com/fairprice && npm run db:backup -- --envFile=.env.production --outputDir=/home/admin/backups/fairprice
```

Store backups outside the web root when possible and periodically copy them to
external storage.

Restore dry-run:

```bash
npm run db:restore -- --envFile=.env.production --file=/home/admin/backups/fairprice/fairprice-2026-07-04.dump
```

Execute restore:

```bash
npm run db:restore -- --envFile=.env.production --file=/home/admin/backups/fairprice/fairprice-2026-07-04.dump --confirm=RESTORE
```

To drop existing objects before restoring, add `--clean=true`. Use this only
after confirming that the target database can be overwritten.

## 12. Search Console

After HTTPS works:

1. Set `NAVER_SITE_VERIFICATION`.
2. Set `GOOGLE_SITE_VERIFICATION`.
3. Rebuild and restart PM2.
4. Submit `https://your-domain.com/sitemap.xml` to Naver Search Advisor and
   Google Search Console.
