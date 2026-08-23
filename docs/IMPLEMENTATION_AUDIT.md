# Fairprice implementation audit

Date: 2026-08-21

## Product objective

Fairprice should answer three questions with trustworthy observed data:

1. Is the current price actually low?
2. Which product option has the best unit value?
3. Should the user buy, wait, or choose an alternative?

The implementation order is data correctness, collection efficiency, decision
support, discovery UX, alerts, and SEO. Public copy must distinguish an observed
price from a seller-provided discount.

## Current assets to retain

- Next.js App Router application with PostgreSQL and Prisma.
- Coupang Partners API signing, product search, Goldbox, category best, and
  deeplink adapters.
- Keyword candidates, collection rules, persistent collection jobs, cron run
  history, and stale-run recovery.
- Product price history recorded on every successful observation.
- User accounts, favorites, target-price and discount alerts, email delivery,
  affiliate click logging, and admin tools.
- Product/category/keyword pages, sitemap, RSS, metadata, JSON-LD, and legal
  disclosure pages.
- Coolify deployment, health checks, production environment validation, and
  PostgreSQL backup/restore scripts.

## Gaps that block the target service

### Product identity

`Product` currently combines a product family, a sellable option, the latest
price, and display content. The external key contains product, item, and vendor
item IDs, but there is no first-class product group or variant relationship.
This prevents reliable option tables, unit-price comparison, and variant-level
alerts.

### Price observations

`ProductPriceHistory` records successful prices but has no source, availability,
collection status, failure reason, or anomaly state. A missing response cannot
be distinguished from an unavailable product. Retention and rollup policies are
also absent.

### Price analysis

Deal statistics are calculated in the request path from a limited history
window. The implementation uses an arithmetic average and sample-count-only
confidence thresholds. It does not persist median, volatility, tracking age,
freshness, anomalous observations, or an explainable score version.

### Collection scheduling

Jobs have priority and retries, but scheduling is driven mainly by active
keyword rules. Products are not assigned adaptive tracking tiers based on
alerts, clicks, freshness, volatility, or inactivity. API budget and per-endpoint
failure state are not represented.

### Error visibility

Several public data loaders silently fall back to sample data or empty results.
That is convenient for local demos but can hide production database and API
failures. Production pages must show truthful degraded states while admin pages
record actionable errors.

### Public experience

The product detail already provides a verdict, chart, observed range, alert
form, and heuristic recommendations. It still lacks variant comparison, unit
prices, a change timeline, data-quality explanations, persistent relations, and
freshness-aware SEO eligibility.

## Target domain boundaries

| Boundary | Responsibility |
| --- | --- |
| Catalog | Product groups, sellable variants, normalized attributes, categories |
| Observation | Immutable checks, price, availability, source, status, anomaly flags |
| Analytics | Rolling statistics, confidence, verdict, Fair Score, score version |
| Discovery | Goldbox, category, keyword, URL, click, and user-interest candidates |
| Scheduling | Tracking tier, next check, retry/backoff, endpoint budget |
| Engagement | Favorites, alert rules, notification deduplication, affiliate clicks |
| Presentation | Deal feeds, product comparison, charts, SEO eligibility |

## Migration strategy

1. Add new tables and nullable relations without removing existing columns.
2. Group records with the same stable Coupang product ID; otherwise backfill
   each current `Product` as one product group with one variant.
3. Dual-write observations and latest-price compatibility fields.
4. Switch analytics and detail pages to the new read model after verification.
5. Remove compatibility fields only in a later, separately approved migration.

This additive approach keeps the live service deployable and supports rollback.

## Delivery gates

| Stage | Acceptance gate |
| --- | --- |
| 1. Audit | Baseline build passes and this audit is reviewed |
| 2. Catalog model | Existing products are backfilled with no lost history |
| 3. Data quality | Low-data and anomalous observations cannot produce strong deal claims |
| 4. Scheduler | Products receive adaptive tiers and failed calls back off safely |
| 5. Analytics | Score inputs, confidence, and score version are inspectable |
| 6. Product detail | Variant, unit-price, chart, timeline, alert, and alternatives work |
| 7. Discovery | Deal, drop, low-price, category, and search flows are useful on mobile |
| 8. Alerts | Confirmation, cooldown, and deduplication prevent noisy notifications |
| 9. SEO | Only fresh, sufficiently informative pages are indexable |
| 10. Operations | Backup restore, monitoring, cron, rollback, and smoke tests pass |

## Decisions for stage 2

- Keep `Product` temporarily as the compatibility record.
- Add `ProductGroup`, `ProductVariant`, and richer `PriceObservation` models.
- Model unit quantity and unit label as nullable structured fields; do not infer
  them from titles in the database migration.
- Preserve all existing price history and external identifiers.
- Use additive migrations and a repeatable backfill script.
