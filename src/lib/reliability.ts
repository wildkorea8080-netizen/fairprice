import "server-only";

import {
  assessReliability,
  type ReliabilityReport,
} from "@/lib/operational-health";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export const RELIABILITY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ReliabilitySnapshot = ReliabilityReport & {
  windowHours: number;
};

/**
 * Counts failures over a rolling window. The freshness checks elsewhere only
 * inspect the newest record, so they stay green while most of the window fails.
 */
export async function getReliabilitySnapshot(): Promise<ReliabilitySnapshot | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const since = new Date(Date.now() - RELIABILITY_WINDOW_MS);

  const [
    cronRunsTotal,
    cronRunsFailed,
    collectionJobsTotal,
    collectionJobsFailed,
    notificationsTotal,
    notificationsFailed,
  ] = await Promise.all([
    prisma.cronRun.count({ where: { startedAt: { gte: since } } }),
    prisma.cronRun.count({
      where: { startedAt: { gte: since }, status: "FAILED" },
    }),
    prisma.collectionJob.count({ where: { updatedAt: { gte: since } } }),
    prisma.collectionJob.count({
      where: { status: "FAILED", updatedAt: { gte: since } },
    }),
    prisma.notificationLog.count({ where: { createdAt: { gte: since } } }),
    prisma.notificationLog.count({
      where: { createdAt: { gte: since }, status: "FAILED" },
    }),
  ]);

  const report = assessReliability({
    collectionJobs: {
      failed: collectionJobsFailed,
      total: collectionJobsTotal,
    },
    cronRuns: { failed: cronRunsFailed, total: cronRunsTotal },
    notifications: {
      failed: notificationsFailed,
      total: notificationsTotal,
    },
  });

  return { ...report, windowHours: RELIABILITY_WINDOW_MS / (60 * 60 * 1000) };
}
