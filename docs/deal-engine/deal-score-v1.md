# Deal Score V1

Deal Score V1 is a deterministic shopping score. It does not call an LLM and
can be reproduced from a price series, confidence state, and stored config.

## Components

The default score is out of 100 points.

| Component | Weight | Full-score condition |
| --- | ---: | --- |
| Recent average price drop | 35 | 30% or more below the observed average |
| Lowest-price proximity | 25 | At or below the observed lowest price |
| Drop velocity | 15 | 15% or more below the previous changed price |
| Historical percentile | 15 | At the bottom of the observed distribution |
| Data confidence | 10 | `RELIABLE` confidence |

Intermediate values are scaled linearly and clamped to their component weight.
The current implementation uses the arithmetic mean for the recent average and
keeps median and percentile values in the compatibility analytics projection.

## Confidence caps

Confidence prevents a new product with only one or two observations from being
promoted as a record deal.

- `COLLECTING` or fewer than five samples: maximum 59
- `PRELIMINARY`: maximum 89
- `RELIABLE`: maximum 100

Both the raw score and applied confidence cap are stored in the analysis
snapshot, so an operator can distinguish a weak price from insufficient data.

## Bands

- 0-59: `GENERAL`
- 60-79: `GOOD`
- 80-89: `DEAL`
- 90-95: `SPECIAL`
- 96-100: `LEGENDARY`

## Configuration and experiments

Weights and thresholds live in `deal_score_configs`. A config is selected by
vertical, activation state, and effective dates. Results retain the config ID,
version, components, reasons, raw score, and final score.

The domain validator requires non-negative weights totaling exactly 100 and
strictly ordered thresholds. Future A/B variants can use `experiment_key`; the
assignment mechanism is intentionally deferred until enough traffic exists.

## Snapshot policy

`product_deal_analytics` remains the latest Fairprice-compatible projection.
`deal_analysis_snapshots` adds an auditable row when the price, score, config,
or UTC date changes. Repeated identical polling within the same day does not
create duplicate score snapshots.
