import "server-only";

import type { CollectionJobStatus, Prisma, PrismaClient } from "@prisma/client";
import { selectBalancedCollectionJobs } from "@/lib/collection-job-selection";
import { collectCoupangKeyword } from "@/lib/coupang/tracker";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type CollectionJobProcessResult = {
  categories: Record<string, number>;
  failed: number;
  processed: number;
  succeeded: number;
};

function getDominantCategory(
  products: Array<{ product: { category: { name: string; slug: string } } }>,
  fallbackKeyword: string,
) {
  const counts = new Map<string, { count: number; name: string }>();

  for (const { product } of products) {
    const current = counts.get(product.category.slug);
    counts.set(product.category.slug, {
      count: (current?.count ?? 0) + 1,
      name: product.category.name,
    });
  }

  return [...counts.entries()]
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
    .map(([key, value]) => ({ key, name: value.name }))[0] ?? {
      key: `keyword:${fallbackKeyword.toLocaleLowerCase("ko-KR")}`,
      name: "미분류",
    };
}

export type CollectionJobOverview = {
  completed: number;
  failed: number;
  latest: Array<{
    attempts: number;
    errorMessage: string | null;
    finishedAt: Date | null;
    id: string;
    keyword: string;
    limit: number;
    priority: number;
    runAfter: Date;
    startedAt: Date | null;
    status: CollectionJobStatus;
  }>;
  pending: number;
  running: number;
};

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

function nextRunDate(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function enqueueCollectionJobs({
  limit = 50,
  runAfter = new Date(),
}: {
  limit?: number;
  runAfter?: Date;
} = {}) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for collection jobs.");
  }

  const rules = await prisma.collectionRule.findMany({
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        select: { finishedAt: true },
        take: 1,
      },
      products: {
        include: {
          product: {
            include: {
              variant: { include: { trackingPolicy: true } },
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: Math.min(Math.max(limit, 1), 200),
    where: {
      isActive: true,
      jobs: {
        none: {
          status: { in: ["PENDING", "RUNNING"] },
        },
      },
    },
  });

  if (rules.length === 0) {
    return 0;
  }

  // Keyword jobs are now discovery only: each rule runs on a fixed interval to
  // find what currently ranks for its keyword. Re-observing specific tracked
  // products is the refresh step's job. Previously this function both gated on
  // per-product policies AND advanced their nextCheckAt - even though a
  // keyword's top-10 usually no longer contained the products whose schedule
  // it was consuming. That silently starved most of the catalog of
  // observations while looking busy.
  const now = new Date();
  const discoveryIntervalMs = 6 * 60 * 60 * 1000;
  const candidates = rules.flatMap((rule) => {
    const latestFinishedAt = rule.jobs[0]?.finishedAt;

    if (
      latestFinishedAt &&
      now.getTime() - latestFinishedAt.getTime() < discoveryIntervalMs
    ) {
      return [];
    }

    const policies = rule.products.flatMap(({ product }) =>
      product.variant?.trackingPolicy ? [product.variant.trackingPolicy] : [],
    );

    return [
      {
        collectionRuleId: rule.id,
        keyword: rule.keyword,
        limit: rule.limit,
        priority:
          policies.length > 0
            ? Math.max(...policies.map((policy) => policy.priorityScore))
            : Math.max(100 - rule.minDiscountRate, 1),
        runAfter,
      },
    ];
  });

  if (candidates.length === 0) {
    return 0;
  }

  await prisma.collectionJob.createMany({
    data: candidates.map((candidate) => ({
      collectionRuleId: candidate.collectionRuleId,
      keyword: candidate.keyword,
      limit: candidate.limit,
      priority: candidate.priority,
      runAfter: candidate.runAfter,
    })),
  });

  return candidates.length;
}

export async function getCollectionJobOverview(): Promise<CollectionJobOverview | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const [pending, running, completed, failed, latest] = await Promise.all([
    prisma.collectionJob.count({ where: { status: "PENDING" } }),
    prisma.collectionJob.count({ where: { status: "RUNNING" } }),
    prisma.collectionJob.count({ where: { status: "COMPLETED" } }),
    prisma.collectionJob.count({ where: { status: "FAILED" } }),
    prisma.collectionJob.findMany({
      include: { collectionRule: true },
      orderBy: [{ createdAt: "desc" }],
      take: 12,
    }),
  ]);

  return {
    completed,
    failed,
    latest,
    pending,
    running,
  };
}

export async function requeueFailedCollectionJobs(limit = 20) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for collection jobs.");
  }

  const failedJobs = await prisma.collectionJob.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true },
    take: Math.min(Math.max(limit, 1), 100),
    where: { status: "FAILED" },
  });

  if (failedJobs.length === 0) {
    return 0;
  }

  const result = await prisma.collectionJob.updateMany({
    data: {
      errorMessage: null,
      finishedAt: null,
      runAfter: new Date(),
      startedAt: null,
      status: "PENDING",
    },
    where: {
      id: { in: failedJobs.map((job) => job.id) },
    },
  });

  return result.count;
}

async function markJob(
  id: string,
  status: CollectionJobStatus,
  data: {
    errorMessage?: string | null;
    finishedAt?: Date | null;
    startedAt?: Date | null;
  } = {},
) {
  return prisma.collectionJob.update({
    data: {
      ...data,
      attempts: status === "RUNNING" ? { increment: 1 } : undefined,
      status,
    },
    where: { id },
  });
}

export async function processPendingCollectionJobs({
  batchSize = 5,
}: {
  batchSize?: number;
} = {}): Promise<CollectionJobProcessResult> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for collection jobs.");
  }

  const candidates = await prisma.collectionJob.findMany({
    include: {
      collectionRule: {
        include: {
          products: {
            include: {
              product: { include: { category: true } },
            },
          },
        },
      },
    },
    orderBy: [{ priority: "desc" }, { runAfter: "asc" }, { createdAt: "asc" }],
    take: Math.min(Math.max(batchSize * 10, 50), 200),
    where: {
      runAfter: { lte: new Date() },
      status: "PENDING",
    },
  });
  const jobs = selectBalancedCollectionJobs(
    candidates.map((job) => {
      const category = getDominantCategory(
        job.collectionRule.products,
        job.keyword,
      );
      return { ...job, categoryKey: category.key, categoryName: category.name };
    }),
    Math.min(Math.max(batchSize, 1), 20),
  );

  let failed = 0;
  let succeeded = 0;
  const categories: Record<string, number> = {};

  for (const job of jobs) {
    categories[job.categoryName] = (categories[job.categoryName] ?? 0) + 1;
    await markJob(job.id, "RUNNING", {
      errorMessage: null,
      startedAt: new Date(),
    });

    try {
      const summary = await collectCoupangKeyword(
        job.keyword,
        job.limit,
        job.collectionRuleId,
      );

      await prisma.$transaction(async (tx: TransactionClient) => {
        await tx.collectionJob.update({
          data: {
            finishedAt: new Date(),
            status: "COMPLETED",
            summary: summary as unknown as Prisma.InputJsonObject,
          },
          where: { id: job.id },
        });
        await tx.collectionRule.update({
          data: { updatedAt: new Date() },
          where: { id: job.collectionRuleId },
        });
      });

      succeeded += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Collection job failed";

      const attemptNumber = job.attempts + 1;
      const retryDelayMinutes = 15 * 2 ** Math.max(attemptNumber - 1, 0);

      await prisma.$transaction(async (tx: TransactionClient) => {
        await tx.collectionJob.update({
          data: {
            errorMessage: message,
            finishedAt: new Date(),
            status: "FAILED",
          },
          where: { id: job.id },
        });

        if (attemptNumber < 3) {
          await tx.collectionJob.create({
            data: {
              attempts: attemptNumber,
              collectionRuleId: job.collectionRuleId,
              keyword: job.keyword,
              limit: job.limit,
              priority: job.priority,
              runAfter: nextRunDate(retryDelayMinutes),
            },
          });
        }
      });
      failed += 1;
    }
  }

  return {
    categories,
    failed,
    processed: jobs.length,
    succeeded,
  };
}
