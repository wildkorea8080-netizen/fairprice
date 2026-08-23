# Price history policy

Fairprice keeps price data in three layers so recent collection quality can be
audited without growing the long-term database at the raw polling rate.

## Raw observations

`price_observations` records every collection attempt, including unchanged
prices, unavailable offers, failures, and anomalous values. Successful records
are linked to both the compatibility `ProductVariant` and the generic `Offer`
during the migration period.

- Recommended retention: 90 days
- Exclude anomalies and failures from price statistics
- Keep request IDs and errors for provider diagnostics
- Do not use raw rows directly for long-range charts

The first production version does not delete raw rows automatically. A cleanup
job should only be enabled after aggregate coverage checks and database backups
are operating reliably.

## Compatibility history

`product_price_histories` remains available to the existing Fairprice pages.
New rows are written when the price changes or when the first valid observation
of a UTC day arrives. This preserves useful chart points while avoiding one row
for every unchanged poll.

This table remains a compatibility projection and is not the long-term Deal
Engine source of truth.

## Daily aggregates

`daily_price_aggregates` keeps one row per offer and UTC date. It contains the
open, close, low, high, median, sample count, availability count, and latest
observation time. Only successful, non-anomalous observations with a price are
included.

- Retention: permanent unless an explicit archival policy is introduced
- Long-range statistics and charts should prefer this table
- The unique `(offer_id, date)` key makes aggregation idempotent
- Each update recalculates the current day from raw observations

## Migration behavior

The migration creates one `DealEntity` and one `Offer` for every existing
`ProductVariant`, links all existing observations, and backfills daily rows.
Existing product and price-history tables are not deleted or renamed.

Run `npm run db:verify-catalog` after deployment. Raw-observation cleanup must
remain disabled if entity, offer, observation, or aggregate coverage checks
fail.
