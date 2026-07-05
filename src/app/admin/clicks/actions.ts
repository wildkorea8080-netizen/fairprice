"use server";

import { redirect } from "next/navigation";
import { createKeywordCandidatesFromTopClicks } from "@/lib/admin-clicks";
import { requireAdmin } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/prisma";

function parseLimit(value: FormDataEntryValue | null) {
  const limit = Number(value);

  if (!Number.isFinite(limit)) {
    return 10;
  }

  return Math.min(Math.max(Math.floor(limit), 1), 30);
}

function parsePeriod(value: FormDataEntryValue | null) {
  const period = String(value ?? "30");

  return period === "1" || period === "7" || period === "30" || period === "all"
    ? period
    : "30";
}

export async function createClickKeywordCandidates(formData: FormData) {
  await requireAdmin("/admin/clicks");

  if (!isDatabaseConfigured()) {
    redirect("/admin/clicks?status=database-required");
  }

  const period = parsePeriod(formData.get("period"));
  const limit = parseLimit(formData.get("limit"));
  const summary = await createKeywordCandidatesFromTopClicks({
    limit,
    period,
  });
  const params = new URLSearchParams({
    candidates: String(summary.candidates),
    products: String(summary.products),
    status: "click-keywords-created",
  });

  redirect(`/admin/clicks?${params.toString()}`);
}
