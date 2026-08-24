export type DealDataConfidence = "COLLECTING" | "PRELIMINARY" | "RELIABLE";

export const DATA_CONFIDENCE_THRESHOLDS = {
  preliminary: { samples: 5, trackingDays: 7 },
  reliable: { samples: 20, trackingDays: 30 },
} as const;

export function calculateDataConfidence(
  validSamples: number,
  trackingDays: number,
): DealDataConfidence {
  if (
    validSamples >= DATA_CONFIDENCE_THRESHOLDS.reliable.samples &&
    trackingDays >= DATA_CONFIDENCE_THRESHOLDS.reliable.trackingDays
  ) {
    return "RELIABLE";
  }

  if (
    validSamples >= DATA_CONFIDENCE_THRESHOLDS.preliminary.samples &&
    trackingDays >= DATA_CONFIDENCE_THRESHOLDS.preliminary.trackingDays
  ) {
    return "PRELIMINARY";
  }

  return "COLLECTING";
}

export function getDataConfidenceProgress(
  confidence: DealDataConfidence,
  validSamples: number,
  trackingDays: number,
) {
  if (confidence === "RELIABLE") {
    return {
      nextConfidence: null,
      progressPercent: 100,
      remainingDays: 0,
      remainingSamples: 0,
      targetDays: DATA_CONFIDENCE_THRESHOLDS.reliable.trackingDays,
      targetSamples: DATA_CONFIDENCE_THRESHOLDS.reliable.samples,
    } as const;
  }

  const nextConfidence = confidence === "COLLECTING" ? "PRELIMINARY" : "RELIABLE";
  const target =
    nextConfidence === "PRELIMINARY"
      ? DATA_CONFIDENCE_THRESHOLDS.preliminary
      : DATA_CONFIDENCE_THRESHOLDS.reliable;
  const sampleProgress = Math.min(validSamples / target.samples, 1);
  const dayProgress = Math.min(trackingDays / target.trackingDays, 1);

  return {
    nextConfidence,
    progressPercent: Math.round(Math.min(sampleProgress, dayProgress) * 100),
    remainingDays: Math.max(target.trackingDays - trackingDays, 0),
    remainingSamples: Math.max(target.samples - validSamples, 0),
    targetDays: target.trackingDays,
    targetSamples: target.samples,
  } as const;
}
