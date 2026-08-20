import { cookies } from "next/headers";
import type { PrismaClient } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type CollectionRule = {
  id: string;
  isActive: boolean;
  keyword: string;
  limit: number;
  minDiscountRate: number;
};

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const COLLECTION_RULES_COOKIE = "fairprice_collection_rules";
const MAX_COUPANG_COLLECTION_LIMIT = 10;

function getDefaultRules(): CollectionRule[] {
  return (process.env.COUPANG_COLLECTION_KEYWORDS ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((keyword, index) => ({
      id: `default-${index}-${Buffer.from(keyword).toString("base64url")}`,
      isActive: true,
      keyword,
      limit: MAX_COUPANG_COLLECTION_LIMIT,
      minDiscountRate: 10,
    }));
}

function decodeRules(value: string): CollectionRule[] {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as CollectionRule[];

    if (!Array.isArray(parsed)) {
      return getDefaultRules();
    }

    return parsed
      .filter((rule) => rule.id && rule.keyword)
      .map((rule) => ({
        id: rule.id,
        isActive: Boolean(rule.isActive),
        keyword: rule.keyword.trim().replace(/\s+/g, " "),
        limit: Math.min(
          Math.max(Number(rule.limit) || MAX_COUPANG_COLLECTION_LIMIT, 1),
          MAX_COUPANG_COLLECTION_LIMIT,
        ),
        minDiscountRate: Math.min(
          Math.max(Number(rule.minDiscountRate) || 0, 0),
          100,
        ),
      }))
      .slice(0, 50);
  } catch {
    return getDefaultRules();
  }
}

export async function getCollectionRules(): Promise<CollectionRule[]> {
  if (isDatabaseConfigured()) {
    const databaseRules = await prisma.collectionRule.findMany({
      orderBy: { createdAt: "asc" },
    });

    if (databaseRules.length > 0) {
      return databaseRules.map((rule: CollectionRule) => ({
        id: rule.id,
        isActive: rule.isActive,
        keyword: rule.keyword,
        limit: rule.limit,
        minDiscountRate: rule.minDiscountRate,
      }));
    }
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(COLLECTION_RULES_COOKIE)?.value;

  return value ? decodeRules(value) : getDefaultRules();
}

export async function setCollectionRules(rules: CollectionRule[]) {
  if (isDatabaseConfigured()) {
    await prisma.$transaction(async (tx: TransactionClient) => {
      const keywords = rules.map((rule) => rule.keyword);

      await tx.collectionRule.deleteMany({
        where: {
          keyword: { notIn: keywords },
        },
      });

      for (const rule of rules) {
        await tx.collectionRule.upsert({
          create: {
            isActive: rule.isActive,
            keyword: rule.keyword,
            limit: rule.limit,
            minDiscountRate: rule.minDiscountRate,
          },
          update: {
            isActive: rule.isActive,
            limit: rule.limit,
            minDiscountRate: rule.minDiscountRate,
          },
          where: { keyword: rule.keyword },
        });
      }
    });
    return;
  }

  const cookieStore = await cookies();
  const value = Buffer.from(JSON.stringify(rules), "utf8").toString(
    "base64url",
  );

  cookieStore.set(COLLECTION_RULES_COOKIE, value, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
