export type ReliabilitySignalName =
  | "collectionJobs"
  | "cronRuns"
  | "notifications";

export type ReliabilityStatus = "critical" | "degraded" | "healthy" | "unknown";

export type ReliabilityCounts = {
  failed: number;
  total: number;
};

export type ReliabilityInput = Record<ReliabilitySignalName, ReliabilityCounts>;

export type ReliabilitySignal = {
  failed: number;
  failureRate: number | null;
  status: ReliabilityStatus;
  total: number;
};

export type ReliabilityReport = {
  reasons: string[];
  signals: Record<ReliabilitySignalName, ReliabilitySignal>;
  status: ReliabilityStatus;
};

/**
 * Below this many samples a single failure would read as a huge percentage, so
 * the signal reports "unknown" instead of crying wolf on a quiet window.
 */
const MINIMUM_SAMPLES = 3;

const THRESHOLDS: Record<
  ReliabilitySignalName,
  { critical: number; degraded: number; label: string }
> = {
  // A whole pipeline run failing is worse than one job inside it failing.
  collectionJobs: { critical: 0.5, degraded: 0.2, label: "상품 수집" },
  cronRuns: { critical: 0.3, degraded: 0.1, label: "자동화 실행" },
  notifications: { critical: 0.5, degraded: 0.2, label: "알림 발송" },
};

const STATUS_RANK: Record<ReliabilityStatus, number> = {
  critical: 3,
  degraded: 2,
  healthy: 1,
  unknown: 0,
};

export function getFailureRate({ failed, total }: ReliabilityCounts) {
  if (total <= 0) {
    return null;
  }

  return Math.min(Math.max(failed, 0), total) / total;
}

function assessSignal(
  name: ReliabilitySignalName,
  counts: ReliabilityCounts,
): ReliabilitySignal {
  const failureRate = getFailureRate(counts);

  if (failureRate === null || counts.total < MINIMUM_SAMPLES) {
    return {
      failed: counts.failed,
      failureRate,
      status: "unknown",
      total: counts.total,
    };
  }

  const thresholds = THRESHOLDS[name];
  const status: ReliabilityStatus =
    failureRate >= thresholds.critical
      ? "critical"
      : failureRate >= thresholds.degraded
        ? "degraded"
        : "healthy";

  return {
    failed: counts.failed,
    failureRate,
    status,
    total: counts.total,
  };
}

export function formatFailureRate(failureRate: number | null) {
  return failureRate === null ? "-" : `${Math.round(failureRate * 100)}%`;
}

/**
 * Rolls the recent failure counts into one verdict. The freshness checks in
 * /api/health only look at the newest run, so a pipeline that succeeds once an
 * hour and fails the rest still reads as fresh. This looks at the whole window.
 */
export function assessReliability(input: ReliabilityInput): ReliabilityReport {
  const signals = {
    collectionJobs: assessSignal("collectionJobs", input.collectionJobs),
    cronRuns: assessSignal("cronRuns", input.cronRuns),
    notifications: assessSignal("notifications", input.notifications),
  };

  const reasons: string[] = [];
  let status: ReliabilityStatus = "unknown";

  for (const name of Object.keys(signals) as ReliabilitySignalName[]) {
    const signal = signals[name];

    if (STATUS_RANK[signal.status] > STATUS_RANK[status]) {
      status = signal.status;
    }

    if (signal.status === "critical" || signal.status === "degraded") {
      reasons.push(
        `${THRESHOLDS[name].label} 실패율 ${formatFailureRate(
          signal.failureRate,
        )} (${signal.failed}/${signal.total})`,
      );
    }
  }

  return { reasons, signals, status };
}

export function isReliabilityHealthy(status: ReliabilityStatus) {
  return status === "healthy" || status === "unknown";
}
