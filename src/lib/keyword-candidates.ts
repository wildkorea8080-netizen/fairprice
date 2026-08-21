import "server-only";

import type { KeywordCandidateStatus, KeywordSourceType } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export const DEFAULT_POPULAR_KEYWORDS = [
  "물티슈",
  "커피",
  "무선이어폰",
  "로봇청소기",
  "공기청정기",
  "제습기",
  "캡슐커피",
  "단백질 보충제",
  "기저귀",
  "멀티탭",
  "샴푸",
  "선크림",
  "영양제",
  "휴지",
  "세탁세제",
  "에어프라이어",
  "노트북 거치대",
  "보조배터리",
  "키보드",
  "모니터",
];

export function normalizeKeyword(keyword: string) {
  return keyword.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

export function splitKeywordInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((keyword) => keyword.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 100);
}

function buildCandidateWhere({
  query,
  sourceType,
  status,
}: {
  query?: string;
  sourceType?: KeywordSourceType;
  status?: KeywordCandidateStatus;
}) {
  const where: {
    OR?: Array<
      | { keyword: { contains: string; mode: "insensitive" } }
      | { note: { contains: string; mode: "insensitive" } }
      | { source: { is: { name: { contains: string; mode: "insensitive" } } } }
    >;
    sourceType?: KeywordSourceType;
    status?: KeywordCandidateStatus;
  } = {};
  const normalizedQuery = query?.trim().replace(/\s+/g, " ");

  if (status) {
    where.status = status;
  }

  if (sourceType) {
    where.sourceType = sourceType;
  }

  if (normalizedQuery) {
    where.OR = [
      {
        keyword: {
          contains: normalizedQuery,
          mode: "insensitive",
        },
      },
      {
        note: {
          contains: normalizedQuery,
          mode: "insensitive",
        },
      },
      {
        source: {
          is: {
            name: {
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

export async function ensureKeywordSource(
  type: KeywordSourceType,
  name: string,
  priority = 50,
) {
  return prisma.keywordSource.upsert({
    create: {
      name,
      priority,
      type,
    },
    update: {
      isActive: true,
      priority,
    },
    where: {
      name_type: {
        name,
        type,
      },
    },
  });
}

export async function upsertKeywordCandidate({
  keyword,
  note,
  score = 50,
  sourceId,
  sourceKey,
  sourceType = "MANUAL",
  status = "NEW",
}: {
  keyword: string;
  note?: string;
  score?: number;
  sourceId?: string;
  sourceKey?: string;
  sourceType?: KeywordSourceType;
  status?: KeywordCandidateStatus;
}) {
  const normalizedKeyword = normalizeKeyword(keyword);

  if (!normalizedKeyword) {
    return null;
  }

  return prisma.keywordCandidate.upsert({
    create: {
      keyword: keyword.trim().replace(/\s+/g, " "),
      normalizedKeyword,
      note,
      score,
      sourceId,
      sourceKey,
      sourceType,
      status,
    },
    update: {
      keyword: keyword.trim().replace(/\s+/g, " "),
      note,
      score: { increment: Math.max(score, 1) },
      sourceId,
      sourceKey,
      sourceType,
      ...(status === "APPROVED" ? { status } : {}),
    },
    where: { normalizedKeyword },
  });
}

export async function seedDefaultKeywordCandidates() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for keyword candidates.");
  }

  const source = await ensureKeywordSource("MANUAL", "Fairprice seed keywords", 80);
  const candidates = await Promise.all(
    DEFAULT_POPULAR_KEYWORDS.map((keyword, index) =>
      upsertKeywordCandidate({
        keyword,
        note: "초기 인기 키워드 시드",
        score: 100 - index,
        sourceId: source.id,
        sourceKey: `seed:${normalizeKeyword(keyword)}`,
        sourceType: "MANUAL",
      }),
    ),
  );

  return candidates.filter(Boolean).length;
}

export async function promoteTopKeywordCandidates({
  limit = 20,
  maxActiveRules,
  minScore = 70,
  sourceType,
}: {
  limit?: number;
  maxActiveRules?: number;
  minScore?: number;
  sourceType?: KeywordSourceType;
}) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for keyword promotion.");
  }

  const activeRuleCount = maxActiveRules
    ? await prisma.collectionRule.count({ where: { isActive: true } })
    : 0;
  const availableSlots = maxActiveRules
    ? Math.max(maxActiveRules - activeRuleCount, 0)
    : limit;
  const promotionLimit = Math.min(limit, availableSlots);

  if (promotionLimit === 0) {
    return 0;
  }

  const candidates = await prisma.keywordCandidate.findMany({
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: Math.min(Math.max(promotionLimit, 1), 100),
    where: {
      score: { gte: Math.min(Math.max(minScore, 0), 1000) },
      ...(sourceType ? { sourceType } : {}),
      status: "NEW",
    },
  });

  if (candidates.length === 0) {
    return 0;
  }

  await prisma.$transaction(async (tx) => {
    for (const candidate of candidates) {
      await tx.keywordCandidate.update({
        data: { status: "APPROVED" },
        where: { id: candidate.id },
      });
      await tx.collectionRule.upsert({
        create: {
          isActive: true,
          keyword: candidate.keyword,
          limit: 10,
          minDiscountRate: 10,
        },
        update: {
          isActive: true,
          limit: 10,
        },
        where: { keyword: candidate.keyword },
      });
    }
  });

  return candidates.length;
}

export async function getKeywordCandidateOverview({
  query,
  sourceType,
  status,
}: {
  query?: string;
  sourceType?: KeywordSourceType;
  status?: KeywordCandidateStatus;
} = {}) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const where = buildCandidateWhere({ query, sourceType, status });
  const [
    total,
    filteredTotal,
    newCount,
    approvedCount,
    rejectedCount,
    sourceTypeCounts,
    sources,
    candidates,
  ] = await Promise.all([
      prisma.keywordCandidate.count(),
      prisma.keywordCandidate.count({ where }),
      prisma.keywordCandidate.count({ where: { status: "NEW" } }),
      prisma.keywordCandidate.count({ where: { status: "APPROVED" } }),
      prisma.keywordCandidate.count({ where: { status: "REJECTED" } }),
      prisma.keywordCandidate.groupBy({
        by: ["sourceType"],
        _count: { _all: true },
        orderBy: { _count: { sourceType: "desc" } },
      }),
      prisma.keywordSource.findMany({
        include: {
          _count: {
            select: { candidates: true },
          },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 20,
      }),
      prisma.keywordCandidate.findMany({
        include: { source: true },
        orderBy: [{ status: "asc" }, { score: "desc" }, { createdAt: "desc" }],
        take: 80,
        where,
      }),
    ]);

  return {
    approvedCount,
    candidates,
    filteredTotal,
    newCount,
    rejectedCount,
    sourceTypeCounts,
    sources,
    total,
  };
}
