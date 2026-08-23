import type { DealScoreConfidence } from "@/modules/deal-engine/domain/deal-score";

export type DealEventType =
  | "AVERAGE_PRICE_DROP"
  | "HIGH_DEAL_SCORE"
  | "LOWEST_30D"
  | "LOWEST_90D"
  | "NEAR_ALL_TIME_LOW"
  | "RAPID_DROP";

export type DealDetectionConfig = {
  averageDropRate: number;
  highDealScore: number;
  nearAllTimeLowRate: number;
  rapidDropRate: number;
};

export type DealDetectionInput = {
  averagePrice: number;
  checkedAt: Date;
  confidence: DealScoreConfidence;
  currentPrice: number;
  history: Array<{ checkedAt: Date; price: number }>;
  previousPrice?: number;
  score: number;
};

export type DetectedDealEvent = {
  evidence: Record<string, number | string>;
  referencePrice?: number;
  type: DealEventType;
};

export const DEFAULT_DEAL_DETECTION_CONFIG: DealDetectionConfig = {
  averageDropRate: 10,
  highDealScore: 90,
  nearAllTimeLowRate: 2,
  rapidDropRate: 10,
};

function dropRate(reference: number, current: number) {
  if (reference <= 0 || current >= reference) return 0;
  return ((reference - current) / reference) * 100;
}

function roundRate(value: number) {
  return Number(value.toFixed(2));
}

function observationsSince(
  history: DealDetectionInput["history"],
  checkedAt: Date,
  days: number,
) {
  const start = checkedAt.getTime() - days * 86_400_000;
  return history.filter(
    ({ checkedAt: observedAt, price }) =>
      price > 0 &&
      observedAt.getTime() < checkedAt.getTime() &&
      observedAt.getTime() >= start,
  );
}

export function detectDealEvents(
  input: DealDetectionInput,
  config: DealDetectionConfig = DEFAULT_DEAL_DETECTION_CONFIG,
) {
  const events: DetectedDealEvent[] = [];
  const validHistory = input.history.filter(
    ({ checkedAt, price }) =>
      price > 0 && checkedAt.getTime() < input.checkedAt.getTime(),
  );
  const averageDrop = dropRate(input.averagePrice, input.currentPrice);
  const rapidDrop = input.previousPrice
    ? dropRate(input.previousPrice, input.currentPrice)
    : 0;
  const history30d = observationsSince(input.history, input.checkedAt, 30);
  const history90d = observationsSince(input.history, input.checkedAt, 90);
  const lowest30d =
    history30d.length > 0
      ? Math.min(...history30d.map(({ price }) => price))
      : undefined;
  const lowest90d =
    history90d.length > 0
      ? Math.min(...history90d.map(({ price }) => price))
      : undefined;
  const allTimeLowest =
    validHistory.length > 0
      ? Math.min(...validHistory.map(({ price }) => price))
      : undefined;

  if (averageDrop >= config.averageDropRate) {
    events.push({
      evidence: {
        averageDropRate: roundRate(averageDrop),
        averagePrice: input.averagePrice,
      },
      referencePrice: input.averagePrice,
      type: "AVERAGE_PRICE_DROP",
    });
  }

  if (
    history30d.length >= 5 &&
    lowest30d !== undefined &&
    input.currentPrice < lowest30d
  ) {
    events.push({
      evidence: { previousLowest30d: lowest30d, sampleCount: history30d.length },
      referencePrice: lowest30d,
      type: "LOWEST_30D",
    });
  }

  if (
    history90d.length >= 10 &&
    lowest90d !== undefined &&
    input.currentPrice < lowest90d
  ) {
    events.push({
      evidence: { previousLowest90d: lowest90d, sampleCount: history90d.length },
      referencePrice: lowest90d,
      type: "LOWEST_90D",
    });
  }

  if (
    validHistory.length >= 5 &&
    allTimeLowest !== undefined &&
    input.currentPrice <=
      allTimeLowest * (1 + config.nearAllTimeLowRate / 100)
  ) {
    events.push({
      evidence: {
        allTimeLowest,
        proximityRate: roundRate(
          ((input.currentPrice - allTimeLowest) / allTimeLowest) * 100,
        ),
        sampleCount: validHistory.length,
      },
      referencePrice: allTimeLowest,
      type: "NEAR_ALL_TIME_LOW",
    });
  }

  if (rapidDrop >= config.rapidDropRate) {
    events.push({
      evidence: {
        dropRate: roundRate(rapidDrop),
        previousPrice: input.previousPrice as number,
      },
      referencePrice: input.previousPrice,
      type: "RAPID_DROP",
    });
  }

  if (input.score >= config.highDealScore) {
    events.push({
      evidence: { confidence: input.confidence, score: input.score },
      type: "HIGH_DEAL_SCORE",
    });
  }

  return events;
}
