"use server";

import type { KeywordSourceType } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { discoverKeywordCandidatesFromCoupang } from "@/lib/coupang/keyword-discovery";
import {
  ensureKeywordSource,
  normalizeKeyword,
  promoteTopKeywordCandidates,
  seedDefaultKeywordCandidates,
  splitKeywordInput,
  upsertKeywordCandidate,
} from "@/lib/keyword-candidates";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const COLLECTION_LIMIT = 10;

function ensureDatabaseOrRedirect() {
  if (!isDatabaseConfigured()) {
    redirect("/admin/keywords?status=database-required");
  }
}

function parseSourceType(
  value: FormDataEntryValue | null,
): KeywordSourceType | undefined {
  if (
    value === "MANUAL" ||
    value === "COUPANG_DISCOVERY" ||
    value === "USER_ACTIVITY" ||
    value === "AI_EXPANSION" ||
    value === "EXTERNAL_TREND"
  ) {
    return value;
  }

  return undefined;
}

export async function addKeywordCandidates(formData: FormData) {
  await requireAdmin("/admin/keywords");
  ensureDatabaseOrRedirect();

  const rawKeywords = String(formData.get("keywords") ?? "");
  const note = String(formData.get("note") ?? "").trim() || undefined;
  const keywords = splitKeywordInput(rawKeywords);

  if (keywords.length === 0) {
    redirect("/admin/keywords?status=keyword-required");
  }

  const source = await ensureKeywordSource("MANUAL", "Admin manual keywords", 90);

  await Promise.all(
    keywords.map((keyword) =>
      upsertKeywordCandidate({
        keyword,
        note,
        score: 70,
        sourceId: source.id,
        sourceKey: `manual:${normalizeKeyword(keyword)}`,
        sourceType: "MANUAL",
      }),
    ),
  );

  redirect(`/admin/keywords?status=keywords-added&count=${keywords.length}`);
}

export async function seedKeywordCandidates() {
  await requireAdmin("/admin/keywords");
  ensureDatabaseOrRedirect();

  const count = await seedDefaultKeywordCandidates();

  redirect(`/admin/keywords?status=keywords-seeded&count=${count}`);
}

export async function discoverCoupangKeywordCandidates(formData: FormData) {
  await requireAdmin("/admin/keywords");
  ensureDatabaseOrRedirect();

  const modeValue = String(formData.get("mode") ?? "all");
  const mode =
    modeValue === "goldbox" || modeValue === "category" ? modeValue : "all";
  const categoryId = Number(formData.get("categoryId")) || 1014;

  try {
    const summary = await discoverKeywordCandidatesFromCoupang({
      categoryId,
      mode,
    });

    redirect(
      `/admin/keywords?status=coupang-keywords-discovered&count=${summary.candidates}&products=${summary.products}`,
    );
  } catch {
    redirect("/admin/keywords?status=coupang-keywords-failed");
  }
}

export async function approveKeywordCandidate(formData: FormData) {
  await requireAdmin("/admin/keywords");
  ensureDatabaseOrRedirect();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    redirect("/admin/keywords?status=keyword-required");
  }

  const candidate = await prisma.keywordCandidate.findUnique({
    where: { id },
  });

  if (!candidate) {
    redirect("/admin/keywords?status=keyword-missing");
  }

  await prisma.$transaction(async (tx) => {
    await tx.keywordCandidate.update({
      data: { status: "APPROVED" },
      where: { id },
    });
    await tx.collectionRule.upsert({
      create: {
        isActive: true,
        keyword: candidate.keyword,
        limit: COLLECTION_LIMIT,
        minDiscountRate: 10,
      },
      update: {
        isActive: true,
        limit: COLLECTION_LIMIT,
      },
      where: { keyword: candidate.keyword },
    });
  });

  redirect("/admin/keywords?status=keyword-approved");
}

export async function approveTopKeywordCandidates(formData: FormData) {
  await requireAdmin("/admin/keywords");
  ensureDatabaseOrRedirect();

  const limit = Math.min(
    Math.max(Number(formData.get("limit")) || 20, 1),
    100,
  );
  const minScore = Math.min(
    Math.max(Number(formData.get("minScore")) || 70, 0),
    1000,
  );
  const sourceType = parseSourceType(formData.get("sourceType"));
  const count = await promoteTopKeywordCandidates({
    limit,
    minScore,
    sourceType,
  });
  const params = new URLSearchParams({
    count: String(count),
    status: "top-keywords-approved",
  });

  if (sourceType) {
    params.set("source", sourceType);
  }

  redirect(`/admin/keywords?${params}`);
}

export async function rejectKeywordCandidate(formData: FormData) {
  await requireAdmin("/admin/keywords");
  ensureDatabaseOrRedirect();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    redirect("/admin/keywords?status=keyword-required");
  }

  await prisma.keywordCandidate.update({
    data: { status: "REJECTED" },
    where: { id },
  });

  redirect("/admin/keywords?status=keyword-rejected");
}

export async function restoreKeywordCandidate(formData: FormData) {
  await requireAdmin("/admin/keywords");
  ensureDatabaseOrRedirect();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    redirect("/admin/keywords?status=keyword-required");
  }

  await prisma.keywordCandidate.update({
    data: { status: "NEW" },
    where: { id },
  });

  redirect("/admin/keywords?status=keyword-restored");
}
