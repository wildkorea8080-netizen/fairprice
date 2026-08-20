import "server-only";

import type { CollectionJobStatus, Prisma, PrismaClient } from "@prisma/client";
import { collectCoupangKeyword } from "@/lib/coupang/tracker";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type CollectionJobProcessResult = {
  failed: number;
  processed: number;
  succeeded: number;
};

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

function nextRunDate(hours = 1) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
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

  await prisma.collectionJob.createMany({
    data: rules.map((rule) => ({
      collectionRuleId: rule.id,
      keyword: rule.keyword,
      limit: rule.limit,
      priority: Math.max(100 - rule.minDiscountRate, 1),
      runAfter,
    })),
  });

  return rules.length;
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

  const jobs = await prisma.collectionJob.findMany({
    include: { collectionRule: true },
    orderBy: [{ priority: "desc" }, { runAfter: "asc" }, { createdAt: "asc" }],
    take: Math.min(Math.max(batchSize, 1), 20),
    where: {
      runAfter: { lte: new Date() },
      status: "PENDING",
    },
  });

  let failed = 0;
  let succeeded = 0;

  for (const job of jobs) {
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
        await tx.collectionJob.create({
          data: {
            collectionRuleId: job.collectionRuleId,
            keyword: job.collectionRule.keyword,
            limit: job.collectionRule.limit,
            priority: job.priority,
            runAfter: nextRunDate(6),
          },
        });
      });

      succeeded += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Collection job failed";

      await prisma.collectionJob.update({
        data: {
          errorMessage: message,
          finishedAt: new Date(),
          runAfter: nextRunDate(1),
          status: "FAILED",
        },
        where: { id: job.id },
      });
      failed += 1;
    }
  }

  return {
    failed,
    processed: jobs.length,
    succeeded,
  };
}
