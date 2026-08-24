"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { ensureDatabaseUser } from "@/lib/users";
import {
  DEFAULT_DEAL_SCORE_CONFIG,
  validateDealScoreConfig,
  type DealScoreThresholds,
  type DealScoreWeights,
} from "@/modules/deal-engine/domain/deal-score";

function readScoreNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  if (!Number.isFinite(value)) throw new Error(`Invalid ${key}`);
  return value;
}

export async function createDealScoreConfigVersion(formData: FormData) {
  await requireAdmin("/admin/deal-engine");

  if (!isDatabaseConfigured()) {
    redirect("/admin/deal-engine?status=database-required");
  }

  try {
    const weights: DealScoreWeights = {
      averageDrop: readScoreNumber(formData, "averageDrop"),
      dataConfidence: readScoreNumber(formData, "dataConfidence"),
      dropVelocity: readScoreNumber(formData, "dropVelocity"),
      historicalPercentile: readScoreNumber(formData, "historicalPercentile"),
      lowestPriceProximity: readScoreNumber(formData, "lowestPriceProximity"),
    };
    const thresholds: DealScoreThresholds = {
      deal: readScoreNumber(formData, "deal"),
      good: readScoreNumber(formData, "good"),
      legendary: readScoreNumber(formData, "legendary"),
      special: readScoreNumber(formData, "special"),
    };
    const latest = await prisma.dealScoreConfig.findFirst({
      orderBy: { version: "desc" },
      where: { key: DEFAULT_DEAL_SCORE_CONFIG.key },
    });
    const version = (latest?.version ?? 0) + 1;

    validateDealScoreConfig({
      key: DEFAULT_DEAL_SCORE_CONFIG.key,
      thresholds,
      version,
      weights,
    });

    const changedAt = new Date();
    await prisma.$transaction([
      prisma.dealScoreConfig.updateMany({
        data: { effectiveTo: changedAt, isActive: false },
        where: { isActive: true, vertical: "SHOPPING" },
      }),
      prisma.dealScoreConfig.create({
        data: {
          effectiveFrom: changedAt,
          isActive: true,
          key: DEFAULT_DEAL_SCORE_CONFIG.key,
          thresholds,
          version,
          vertical: "SHOPPING",
          weights,
        },
      }),
    ]);
  } catch {
    redirect("/admin/deal-engine?status=score-config-invalid#score-config");
  }

  redirect("/admin/deal-engine?status=score-config-created#score-config");
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();

  redirect(`/admin/products?status=created&title=${encodeURIComponent(title)}`);
}

export async function updateProduct(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();

  redirect(`/admin/products?status=updated&slug=${encodeURIComponent(slug)}`);
}

export async function hideProduct(formData: FormData) {
  await requireAdmin("/admin/products");
  const slug = String(formData.get("slug") ?? "").trim();

  if (!isDatabaseConfigured() || !slug) {
    redirect("/admin/products?status=database-required");
  }

  await prisma.product.update({
    data: { isActive: false },
    where: { slug },
  });

  redirect(`/admin/products?status=hidden&slug=${encodeURIComponent(slug)}`);
}

export async function restoreProduct(formData: FormData) {
  await requireAdmin("/admin/products");
  const slug = String(formData.get("slug") ?? "").trim();

  if (!isDatabaseConfigured() || !slug) {
    redirect("/admin/products?status=database-required");
  }

  await prisma.product.update({
    data: { isActive: true },
    where: { slug },
  });

  redirect(
    `/admin/products?status=restored&view=hidden&slug=${encodeURIComponent(slug)}`,
  );
}

export async function toggleFeaturedProduct(formData: FormData) {
  await requireAdmin("/admin/products");
  const slug = String(formData.get("slug") ?? "").trim();
  const nextFeatured = String(formData.get("nextFeatured")) === "true";

  if (!isDatabaseConfigured() || !slug) {
    redirect("/admin/products?status=database-required");
  }

  await prisma.product.update({
    data: { isFeatured: nextFeatured },
    where: { slug },
  });

  redirect(
    `/admin/products?status=${nextFeatured ? "featured" : "unfeatured"}&slug=${encodeURIComponent(slug)}`,
  );
}

export async function addProductNote(formData: FormData) {
  const admin = await requireAdmin("/admin/products");
  const slug = String(formData.get("slug") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!isDatabaseConfigured() || !slug) {
    redirect("/admin/products?status=database-required");
  }

  if (!note) {
    redirect("/admin/products?status=note-required");
  }

  const [adminUser, product] = await Promise.all([
    ensureDatabaseUser(admin),
    prisma.product.findUnique({
      select: { id: true },
      where: { slug },
    }),
  ]);

  if (!adminUser || !product) {
    redirect("/admin/products?status=note-failed");
  }

  await prisma.adminProductNote.create({
    data: {
      adminUserId: adminUser.id,
      note,
      productId: product.id,
    },
  });

  redirect(`/admin/products?status=note-saved&slug=${encodeURIComponent(slug)}`);
}

export async function saveCategory(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();

  redirect(`/admin/categories?status=saved&slug=${encodeURIComponent(slug)}`);
}
