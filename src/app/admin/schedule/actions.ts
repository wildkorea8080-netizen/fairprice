"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { runCronPipeline, type CronPipelineStep } from "@/lib/cron-pipeline";
import { isDatabaseConfigured } from "@/lib/prisma";

const ALLOWED_STEPS = new Set<CronPipelineStep>([
  "discover",
  "click-keywords",
  "collect",
  "alerts",
  "send",
]);

function parseSteps(value: FormDataEntryValue | null) {
  if (!value) {
    return undefined;
  }

  const steps = String(value)
    .split(",")
    .map((step) => step.trim())
    .filter((step): step is CronPipelineStep =>
      ALLOWED_STEPS.has(step as CronPipelineStep),
    );

  return steps.length > 0 ? steps : undefined;
}

function parseBoolean(value: FormDataEntryValue | null) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "").toLowerCase(),
  );
}

export async function runSchedulePipeline(formData: FormData) {
  await requireAdmin("/admin/schedule");

  if (!isDatabaseConfigured()) {
    redirect("/admin/schedule?status=database-required");
  }

  const batchSize = Math.min(
    Math.max(Number(formData.get("batchSize")) || 5, 1),
    20,
  );
  const categoryId = Number(formData.get("categoryId")) || 1014;
  const sendDryRun = parseBoolean(formData.get("sendDryRun"));
  const steps = parseSteps(formData.get("steps"));

  const summary = await runCronPipeline({
    batchSize,
    categoryId,
    clickKeywordLimit: 10,
    sendDryRun,
    steps,
  });

  const query = new URLSearchParams({
    failed: String(summary.failed),
    runId: summary.runId,
    status: summary.failed > 0 ? "pipeline-failed" : "pipeline-ran",
    succeeded: String(summary.succeeded),
  });

  redirect(`/admin/schedule?${query}`);
}
