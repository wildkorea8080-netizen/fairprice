import "server-only";

import type { Prisma } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type AlertEvaluationSummary = {
  created: number;
  matched: number;
  rules: number;
  skippedDuplicates: number;
};

export type NotificationStatusFilter = "PENDING" | "SENT" | "FAILED";

const WON_FORMATTER = new Intl.NumberFormat("ko-KR");

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
}

function productMatchesKeyword(productTitle: string, keyword?: string | null) {
  if (!keyword) {
    return true;
  }

  return normalizeSearchText(productTitle).includes(normalizeSearchText(keyword));
}

function productMatchesRule(
  product: {
    categoryId: string;
    currentPrice: number;
    discountRate: number;
    id: string;
    title: string;
  },
  rule: {
    categoryId: string | null;
    keyword: string | null;
    maxPrice: number | null;
    minDiscountRate: number | null;
    productId: string | null;
  },
) {
  if (rule.productId && rule.productId !== product.id) {
    return false;
  }

  if (rule.categoryId && rule.categoryId !== product.categoryId) {
    return false;
  }

  if (!productMatchesKeyword(product.title, rule.keyword)) {
    return false;
  }

  if (
    rule.minDiscountRate !== null &&
    product.discountRate < rule.minDiscountRate
  ) {
    return false;
  }

  if (rule.maxPrice !== null && product.currentPrice > rule.maxPrice) {
    return false;
  }

  return product.discountRate > 0 || rule.maxPrice !== null;
}

function createSubject(product: {
  currentPrice: number;
  discountRate: number;
  title: string;
}) {
  const price = WON_FORMATTER.format(product.currentPrice);

  return `[페어프라이스] ${product.discountRate}% 특가: ${product.title} (${price}원)`;
}

function buildNotificationWhere({
  filter,
  query,
}: {
  filter?: NotificationStatusFilter;
  query?: string;
}) {
  const where: Prisma.NotificationLogWhereInput = {};
  const normalizedQuery = query?.trim().replace(/\s+/g, " ");

  if (filter) {
    where.status = filter;
  }

  if (normalizedQuery) {
    where.OR = [
      {
        subject: {
          contains: normalizedQuery,
          mode: "insensitive",
        },
      },
      {
        user: {
          is: {
            email: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
        },
      },
      {
        product: {
          is: {
            title: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  return where;
}

export async function evaluateAlertRules(): Promise<AlertEvaluationSummary> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for alert evaluation.");
  }

  const [rules, products] = await Promise.all([
    prisma.alertRule.findMany({
      include: { user: true },
      where: { isActive: true },
    }),
    prisma.product.findMany({
      select: {
        categoryId: true,
        currentPrice: true,
        discountRate: true,
        id: true,
        title: true,
      },
      where: {
        coupangExternalId: { not: null },
        isActive: true,
      },
    }),
  ]);

  let created = 0;
  let matched = 0;
  let skippedDuplicates = 0;

  for (const rule of rules) {
    const matchingProducts = products.filter((product) =>
      productMatchesRule(product, rule),
    );

    matched += matchingProducts.length;

    for (const product of matchingProducts) {
      const duplicate = await prisma.notificationLog.findFirst({
        select: { id: true },
        where: {
          alertRuleId: rule.id,
          productId: product.id,
          userId: rule.userId,
        },
      });

      if (duplicate) {
        skippedDuplicates += 1;
        continue;
      }

      await prisma.notificationLog.create({
        data: {
          alertRuleId: rule.id,
          productId: product.id,
          status: "PENDING",
          subject: createSubject(product),
          userId: rule.userId,
        },
      });
      created += 1;
    }
  }

  return {
    created,
    matched,
    rules: rules.length,
    skippedDuplicates,
  };
}

export async function getNotificationOverview(
  filter?: NotificationStatusFilter,
  query?: string,
) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const latestWhere = buildNotificationWhere({ filter, query });

  const [pending, sent, failed, latest] = await Promise.all([
    prisma.notificationLog.count({ where: { status: "PENDING" } }),
    prisma.notificationLog.count({ where: { status: "SENT" } }),
    prisma.notificationLog.count({ where: { status: "FAILED" } }),
    prisma.notificationLog.findMany({
      include: {
        alertRule: true,
        product: true,
        user: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      where: latestWhere,
    }),
  ]);

  return {
    failed,
    latest,
    pending,
    sent,
  };
}
