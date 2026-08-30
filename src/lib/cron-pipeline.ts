import "server-only";

import type { Prisma } from "@prisma/client";
import { evaluateAlertRules } from "@/lib/alert-evaluator";
import { createKeywordCandidatesFromTopClicks } from "@/lib/admin-clicks";
import {
  enqueueCollectionJobs,
  processPendingCollectionJobs,
} from "@/lib/collection-jobs";
import { discoverKeywordCandidatesFromCoupang } from "@/lib/coupang/keyword-discovery";
import { promoteTopKeywordCandidates } from "@/lib/keyword-candidates";
import { dispatchDealPush } from "@/lib/push-dispatch";
import { refreshDueTrackedProducts } from "@/lib/product-refresh";
import { sendPendingNotifications } from "@/lib/notification-sender";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { refreshTrackingPolicies } from "@/lib/tracking-policies";

export type CronPipelineStep =
  | "discover"
  | "click-keywords"
  | "collect"
  | "refresh"
  | "alerts"
  | "send"
  | "push";

export type CronPipelineOptions = {
  batchSize?: number;
  refreshBudget?: number;
  categoryId?: number;
  clickKeywordLimit?: number;
  sendDryRun?: boolean;
  steps?: CronPipelineStep[];
};

export type CronPipelineStepResult = {
  durationMs: number;
  name: CronPipelineStep;
  result?: unknown;
  status: "skipped" | "success" | "failed";
  error?: string;
};

const DEFAULT_STEPS: CronPipelineStep[] = [
  "discover",
  "click-keywords",
  "collect",
  "refresh",
  "alerts",
  "send",
  "push",
];
const STALE_RUN_TIMEOUT_MS = 15 * 60 * 1000;
const DISCOVERY_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export class CronPipelineAlreadyRunningError extends Error {
  runId: string;

  constructor(runId: string) {
    super(`Cron pipeline ${runId} is already running.`);
    this.name = "CronPipelineAlreadyRunningError";
    this.runId = runId;
  }
}

function elapsedSince(startedAt: number) {
  return Date.now() - startedAt;
}

function normalizeSteps(steps?: CronPipelineStep[]) {
  if (!steps || steps.length === 0) {
    return DEFAULT_STEPS;
  }

  const allowed = new Set<CronPipelineStep>(DEFAULT_STEPS);
  return steps.filter((step) => allowed.has(step));
}

function buildRunOptions(options: CronPipelineOptions) {
  return {
    batchSize: options.batchSize ?? 5,
    categoryId: options.categoryId ?? 1014,
    clickKeywordLimit: options.clickKeywordLimit ?? 10,
    sendDryRun: options.sendDryRun ?? null,
  };
}

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function shouldRefreshCoupangDiscovery() {
  const latestCandidate = await prisma.keywordCandidate.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
    where: { sourceType: "COUPANG_DISCOVERY" },
  });

  return (
    !latestCandidate ||
    Date.now() - latestCandidate.updatedAt.getTime() >=
      DISCOVERY_REFRESH_INTERVAL_MS
  );
}

export async function markStaleCronRuns() {
  if (!isDatabaseConfigured()) {
    return 0;
  }

  const timeoutAt = new Date(Date.now() - STALE_RUN_TIMEOUT_MS);
  const result = await prisma.cronRun.updateMany({
    data: {
      errorMessage: "Cron run timed out before completion.",
      failedSteps: 1,
      finishedAt: new Date(),
      status: "FAILED",
    },
    where: {
      finishedAt: null,
      startedAt: { lt: timeoutAt },
      status: "RUNNING",
    },
  });

  return result.count;
}

async function runStep<T>(
  name: CronPipelineStep,
  task: () => Promise<T>,
): Promise<CronPipelineStepResult> {
  const startedAt = Date.now();

  try {
    const result = await task();

    return {
      durationMs: elapsedSince(startedAt),
      name,
      result,
      status: "success",
    };
  } catch (error) {
    return {
      durationMs: elapsedSince(startedAt),
      error: error instanceof Error ? error.message : "Step failed",
      name,
      status: "failed",
    };
  }
}

export async function runCronPipeline(options: CronPipelineOptions = {}) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for cron pipeline.");
  }

  await markStaleCronRuns();

  const activeRun = await prisma.cronRun.findFirst({
    orderBy: { startedAt: "desc" },
    select: { id: true },
    where: {
      finishedAt: null,
      status: "RUNNING",
    },
  });

  if (activeRun) {
    throw new CronPipelineAlreadyRunningError(activeRun.id);
  }

  const steps = normalizeSteps(options.steps);
  const startedAt = Date.now();
  const results: CronPipelineStepResult[] = [];
  const run = await prisma.cronRun.create({
    data: {
      options: buildRunOptions(options),
      requestedSteps: steps,
      status: "RUNNING",
    },
  });

  try {
    if (steps.includes("discover")) {
      results.push(
        await runStep("discover", async () => {
          const refreshDiscovery = await shouldRefreshCoupangDiscovery();
          const discovery = refreshDiscovery
            ? await discoverKeywordCandidatesFromCoupang({
                categoryId: options.categoryId ?? 1014,
                mode: "all",
              })
            : { candidates: 0, products: 0 };
          const promoted = await promoteTopKeywordCandidates({
            limit: 3,
            maxActiveRules: 100,
            minScore: 160,
            sourceType: "COUPANG_DISCOVERY",
          });

          return {
            ...discovery,
            promoted,
            refreshed: refreshDiscovery,
          };
        }),
      );
    }

    if (steps.includes("click-keywords")) {
      results.push(
        await runStep("click-keywords", () =>
          createKeywordCandidatesFromTopClicks({
            limit: options.clickKeywordLimit ?? 10,
            period: "30",
          }),
        ),
      );
    }

    if (steps.includes("collect")) {
      results.push(
        await runStep("collect", async () => {
          const policiesBeforeCollection = await refreshTrackingPolicies();
          const enqueued = await enqueueCollectionJobs();
          const processed = await processPendingCollectionJobs({
            batchSize: options.batchSize ?? 5,
          });
          const policies = await refreshTrackingPolicies();

          return { enqueued, policies, policiesBeforeCollection, processed };
        }),
      );
    }

    if (steps.includes("refresh")) {
      results.push(
        await runStep("refresh", () =>
          refreshDueTrackedProducts({ budget: options.refreshBudget }),
        ),
      );
    }

    if (steps.includes("push")) {
      results.push(await runStep("push", dispatchDealPush));
    }

    if (steps.includes("alerts")) {
      results.push(await runStep("alerts", evaluateAlertRules));
    }

    if (steps.includes("send")) {
      results.push(
        await runStep("send", () =>
          sendPendingNotifications({
            dryRun: options.sendDryRun,
            limit: 50,
          }),
        ),
      );
    }

    const failed = results.filter((result) => result.status === "failed").length;
    const succeeded = results.filter(
      (result) => result.status === "success",
    ).length;
    const summary = {
      completedAt: new Date().toISOString(),
      failed,
      results,
      runId: run.id,
      succeeded,
    };

    await prisma.cronRun.update({
      data: {
        durationMs: elapsedSince(startedAt),
        failedSteps: failed,
        finishedAt: new Date(),
        status: failed > 0 ? "FAILED" : "SUCCESS",
        succeededSteps: succeeded,
        summary: toInputJson(summary),
      },
      where: { id: run.id },
    });

    return summary;
  } catch (error) {
    await prisma.cronRun.update({
      data: {
        durationMs: elapsedSince(startedAt),
        errorMessage:
          error instanceof Error ? error.message : "Cron pipeline failed",
        failedSteps: Math.max(1, results.length),
        finishedAt: new Date(),
        status: "FAILED",
        summary: toInputJson({ results }),
      },
      where: { id: run.id },
    });

    throw error;
  }
}

export async function getCronScheduleOverview() {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const staleCronRuns = await markStaleCronRuns();
  const [
    products,
    priceHistories,
    jobs,
    notifications,
    keywords,
    cronRuns,
    trackingPolicies,
  ] =
    await Promise.all([
      prisma.product.count(),
      prisma.productPriceHistory.count(),
      prisma.collectionJob.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.notificationLog.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.keywordCandidate.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.cronRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 10,
      }),
      prisma.productTrackingPolicy.groupBy({
        by: ["tier"],
        _count: { _all: true },
      }),
    ]);

  return {
    cronRuns,
    jobs,
    keywords,
    notifications,
    priceHistories,
    products,
    staleCronRuns,
    trackingPolicies,
  };
}
