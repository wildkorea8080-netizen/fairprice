"use server";

import { redirect } from "next/navigation";
import { evaluateAlertRules } from "@/lib/alert-evaluator";
import { requireAdmin } from "@/lib/auth";
import {
  getNotificationEmailStatus,
  sendTestNotificationEmail,
  sendPendingNotifications,
} from "@/lib/notification-sender";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

function parseBoolean(value: FormDataEntryValue | null) {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "").toLowerCase(),
  );
}

function parseLimit(value: FormDataEntryValue | null) {
  const limit = Number(value);

  if (!Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(Math.max(Math.floor(limit), 1), 100);
}

export async function evaluateNotificationsNow() {
  await requireAdmin("/admin/notifications");

  if (!isDatabaseConfigured()) {
    redirect("/admin/notifications?status=database-required");
  }

  const summary = await evaluateAlertRules();
  const query = new URLSearchParams({
    created: String(summary.created),
    matched: String(summary.matched),
    rules: String(summary.rules),
    skipped: String(summary.skippedDuplicates),
    status: "evaluated",
  });

  redirect(`/admin/notifications?${query}`);
}

export async function sendNotificationsNow(formData: FormData) {
  await requireAdmin("/admin/notifications");

  if (!isDatabaseConfigured()) {
    redirect("/admin/notifications?status=database-required");
  }

  const dryRun = parseBoolean(formData.get("dryRun"));
  const limit = parseLimit(formData.get("limit"));

  if (!dryRun && !getNotificationEmailStatus().isConfigured) {
    redirect("/admin/notifications?status=email-required");
  }

  const summary = await sendPendingNotifications({ dryRun, limit });
  const query = new URLSearchParams({
    failed: String(summary.failed),
    inspected: String(summary.inspected),
    sent: String(summary.sent),
    skipped: String(summary.skipped),
    status: dryRun ? "send-dry-run" : "sent",
  });

  redirect(`/admin/notifications?${query}`);
}

export async function retryFailedNotifications() {
  await requireAdmin("/admin/notifications");

  if (!isDatabaseConfigured()) {
    redirect("/admin/notifications?status=database-required");
  }

  const result = await prisma.notificationLog.updateMany({
    data: {
      errorMessage: null,
      sentAt: null,
      status: "PENDING",
    },
    where: {
      status: "FAILED",
    },
  });

  const query = new URLSearchParams({
    count: String(result.count),
    status: "failed-retried",
  });

  redirect(`/admin/notifications?${query}`);
}

export async function sendTestNotificationNow(formData: FormData) {
  await requireAdmin("/admin/notifications");

  const to = String(formData.get("to") ?? "").trim();

  if (!getNotificationEmailStatus().isConfigured) {
    redirect("/admin/notifications?status=email-required");
  }

  if (!to) {
    redirect("/admin/notifications?status=test-email-required");
  }

  try {
    const summary = await sendTestNotificationEmail(to);
    const query = new URLSearchParams({
      status: "test-email-sent",
      to: summary.to,
    });

    redirect(`/admin/notifications?${query}`);
  } catch (error) {
    const query = new URLSearchParams({
      error: error instanceof Error ? error.message.slice(0, 160) : "failed",
      status: "test-email-failed",
    });

    redirect(`/admin/notifications?${query}`);
  }
}
