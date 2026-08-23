export type DealScoreConfidence = "COLLECTING" | "PRELIMINARY" | "RELIABLE";

export type DealScoreWeights = {
  averageDrop: number;
  dataConfidence: number;
  dropVelocity: number;
  historicalPercentile: number;
  lowestPriceProximity: number;
};

export type DealScoreThresholds = {
  deal: number;
  good: number;
  legendary: number;
  special: number;
};

export type DealScoreConfig = {
  key: string;
  thresholds: DealScoreThresholds;
  version: number;
  weights: DealScoreWeights;
};

export type DealScoreInput = {
  averagePrice: number;
  confidence: DealScoreConfidence;
  currentPrice: number;
  historicalPercentile: number;
  lowestPrice: number;
  previousPrice?: number;
  sampleCount: number;
};

export type DealScoreBand =
  | "DEAL"
  | "GENERAL"
  | "GOOD"
  | "LEGENDARY"
  | "SPECIAL";

const REQUIRED_WEIGHT_TOTAL = 100;

export const DEFAULT_DEAL_SCORE_CONFIG: DealScoreConfig = {
  key: "shopping-deal-score",
  thresholds: {
    deal: 80,
    good: 60,
    legendary: 96,
    special: 90,
  },
  version: 1,
  weights: {
    averageDrop: 35,
    dataConfidence: 10,
    dropVelocity: 15,
    historicalPercentile: 15,
    lowestPriceProximity: 25,
  },
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function rate(reference: number, current: number) {
  if (reference <= 0 || current >= reference) return 0;
  return ((reference - current) / reference) * 100;
}

export function validateDealScoreConfig(config: DealScoreConfig) {
  const weights = Object.values(config.weights);
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error("Deal Score 가중치는 0 이상의 숫자여야 합니다.");
  }

  if (total !== REQUIRED_WEIGHT_TOTAL) {
    throw new Error(`Deal Score 가중치 합계는 ${REQUIRED_WEIGHT_TOTAL}이어야 합니다.`);
  }

  const { deal, good, legendary, special } = config.thresholds;

  if (!(0 <= good && good < deal && deal < special && special < legendary && legendary <= 100)) {
    throw new Error("Deal Score 판정 임계값 순서가 올바르지 않습니다.");
  }
}

export function calculateDealScore(
  input: DealScoreInput,
  config: DealScoreConfig = DEFAULT_DEAL_SCORE_CONFIG,
) {
  validateDealScoreConfig(config);

  const averageDropRate = rate(input.averagePrice, input.currentPrice);
  const dropVelocityRate = input.previousPrice
    ? rate(input.previousPrice, input.currentPrice)
    : 0;
  const averageToLowRange = Math.max(input.averagePrice - input.lowestPrice, 0);
  const lowestPriceProximity =
    input.currentPrice <= input.lowestPrice
      ? 1
      : averageToLowRange > 0
        ? clamp(
            1 -
              (input.currentPrice - input.lowestPrice) / averageToLowRange,
          )
        : 0;
  const confidenceRatio =
    input.confidence === "RELIABLE"
      ? 1
      : input.confidence === "PRELIMINARY"
        ? 0.6
        : 0.2;
  const components = {
    averageDrop: Math.round(
      clamp(averageDropRate / 30) * config.weights.averageDrop,
    ),
    dataConfidence: Math.round(
      confidenceRatio * config.weights.dataConfidence,
    ),
    dropVelocity: Math.round(
      clamp(dropVelocityRate / 15) * config.weights.dropVelocity,
    ),
    historicalPercentile: Math.round(
      clamp((100 - input.historicalPercentile) / 100) *
        config.weights.historicalPercentile,
    ),
    lowestPriceProximity: Math.round(
      lowestPriceProximity * config.weights.lowestPriceProximity,
    ),
  };
  const rawScore = Object.values(components).reduce(
    (sum, component) => sum + component,
    0,
  );
  const confidenceCap =
    input.confidence === "COLLECTING" || input.sampleCount < 5
      ? 59
      : input.confidence === "PRELIMINARY"
        ? 89
        : 100;
  const score = Math.min(rawScore, confidenceCap);
  const band: DealScoreBand =
    score >= config.thresholds.legendary
      ? "LEGENDARY"
      : score >= config.thresholds.special
        ? "SPECIAL"
        : score >= config.thresholds.deal
          ? "DEAL"
          : score >= config.thresholds.good
            ? "GOOD"
            : "GENERAL";

  return {
    averageDropRate: Number(averageDropRate.toFixed(2)),
    band,
    components,
    confidenceCap,
    dropVelocityRate: Number(dropVelocityRate.toFixed(2)),
    lowestPriceProximity: Number((lowestPriceProximity * 100).toFixed(2)),
    rawScore,
    score,
    scoreVersion: `${config.key}-v${config.version}`,
  };
}
