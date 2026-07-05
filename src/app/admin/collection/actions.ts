"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  getCollectionRules,
  setCollectionRules,
} from "@/lib/collection-rules";
import { collectCoupangKeyword } from "@/lib/coupang/tracker";
import { isDatabaseConfigured } from "@/lib/prisma";

const MAX_COUPANG_COLLECTION_LIMIT = 10;

export async function collectAndTrackProducts(formData: FormData) {
  await requireAdmin("/admin/collection");
  const keyword = String(formData.get("keyword") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const limit = Math.min(
    Math.max(Number(formData.get("limit")) || MAX_COUPANG_COLLECTION_LIMIT, 1),
    MAX_COUPANG_COLLECTION_LIMIT,
  );
  const returnUrl = `/admin/collection?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;

  if (!keyword) {
    redirect("/admin/collection?status=keyword-required");
  }

  if (!isDatabaseConfigured()) {
    redirect(`${returnUrl}&status=database-required`);
  }

  let summary;

  try {
    summary = await collectCoupangKeyword(keyword, limit);
  } catch {
    redirect(`${returnUrl}&status=tracking-failed`);
  }

  const query = new URLSearchParams({
    changed: String(summary.changed),
    created: String(summary.created),
    keyword,
    limit: String(limit),
    status: "tracked",
    unchanged: String(summary.unchanged),
  });

  redirect(`/admin/collection?${query}`);
}

export async function addCollectionRule(formData: FormData) {
  await requireAdmin("/admin/collection");
  const keyword = String(formData.get("keyword") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const limit = Math.min(
    Math.max(Number(formData.get("limit")) || MAX_COUPANG_COLLECTION_LIMIT, 1),
    MAX_COUPANG_COLLECTION_LIMIT,
  );
  const minDiscountRate = Math.min(
    Math.max(Number(formData.get("minDiscountRate")) || 0, 0),
    100,
  );

  if (!keyword) {
    redirect("/admin/collection?status=rule-invalid");
  }

  const rules = await getCollectionRules();
  const existing = rules.find(
    (rule) => rule.keyword.toLocaleLowerCase("ko-KR") === keyword.toLocaleLowerCase("ko-KR"),
  );

  await setCollectionRules(
    existing
      ? rules.map((rule) =>
          rule.id === existing.id
            ? { ...rule, isActive: true, limit, minDiscountRate }
            : rule,
        )
      : [
          {
            id: crypto.randomUUID(),
            isActive: true,
            keyword,
            limit,
            minDiscountRate,
          },
          ...rules,
        ],
  );

  redirect("/admin/collection?status=rule-saved");
}

export async function toggleCollectionRule(formData: FormData) {
  await requireAdmin("/admin/collection");
  const id = String(formData.get("id") ?? "");
  const rules = await getCollectionRules();

  await setCollectionRules(
    rules.map((rule) =>
      rule.id === id ? { ...rule, isActive: !rule.isActive } : rule,
    ),
  );

  redirect("/admin/collection?status=rule-toggled");
}

export async function removeCollectionRule(formData: FormData) {
  await requireAdmin("/admin/collection");
  const id = String(formData.get("id") ?? "");
  const rules = await getCollectionRules();

  await setCollectionRules(rules.filter((rule) => rule.id !== id));
  redirect("/admin/collection?status=rule-removed");
}
