# Deal detection and Hot Deals

Deal detection runs after a successful, non-anomalous price observation and
Deal Score calculation. Rules are deterministic and do not call an LLM.

## Event rules

- `AVERAGE_PRICE_DROP`: current price is at least 10% below the observed average
- `LOWEST_30D`: current price is below the prior 30-day minimum with 5+ samples
- `LOWEST_90D`: current price is below the prior 90-day minimum with 10+ samples
- `NEAR_ALL_TIME_LOW`: within 2% of the prior all-time minimum with 5+ samples
- `RAPID_DROP`: at least 10% below the previous changed price
- `HIGH_DEAL_SCORE`: Deal Score reaches the active score config's `special`
  threshold (90 by default)

The current observation is excluded from historical reference minima. This
prevents a new value from comparing against itself.

## Deduplication

Each event fingerprint contains the offer, event type, trigger price, and UTC
date. Repeated polling of the same price on the same day updates the existing
event instead of inserting another row.

Each Hot Deal has an offer/day dedupe key. Multiple qualifying events select a
single primary event using this priority:

1. High Deal Score
2. 90-day low
3. 30-day low
4. Rapid drop
5. Near all-time low
6. Average-price drop

All events remain attached to the offer as analysis evidence even when no Hot
Deal is activated.

## Activation and expiry

Activation is two-tiered (`domain/deal-activation.ts`):

- **CONFIRMED**: confidence is `RELIABLE` and Deal Score reaches the config's
  `special` threshold (90 by default)
- **CANDIDATE**: confidence is `PRELIMINARY` or `RELIABLE` and the score
  reaches the config's `deal` threshold (80 by default)

The original single rule required `special` with any non-COLLECTING
confidence, but the PRELIMINARY score cap (89) sits below the `special`
threshold (90), so PRELIMINARY activation was unsatisfiable and nothing ever
activated until a product reached RELIABLE. The candidate tier sits inside the
PRELIMINARY cap so a product with a week of history can surface while its
confidence is stated honestly in the UI.

Active deals expire after 48 hours unless a later qualifying observation
refreshes the same daily deal. When the score drops below the activation rule,
the offer's current active deal is marked `EXPIRED`.

The next feed layer should query `ACTIVE` deals with a future `expires_at` and
order by `rank_score`, then recency.
