import "server-only";

import { createHash } from "node:crypto";
import type { DataConfidence, Prisma } from "@prisma/client";
import { getDealActivationTier } from "@/modules/deal-engine/domain/deal-activation";
import {
  DEFAULT_DEAL_DETECTION_CONFIG,
  detectDealEvents,
  type DealEventType,
} from "@/modules/deal-engine/domain/deal-detection";

const HOT_DEAL_LIFETIME_MS = 48 * 3_600_000;

const EVENT_PRIORITY: Record<DealEventType, number> = {
  HIGH_DEAL_SCORE: 6,
  LOWEST_90D: 5,
  LOWEST_30D: 4,
  RAPID_DROP: 3,
  NEAR_ALL_TIME_LOW: 2,
  AVERAGE_PRICE_DROP: 1,
};

const EVENT_SUMMARY: Record<DealEventType, string> = {
  AVERAGE_PRICE_DROP: "최근 평균가보다 크게 낮아졌습니다.",
  HIGH_DEAL_SCORE: "가격과 데이터 신뢰도를 함께 검증한 고득점 특가입니다.",
  LOWEST_30D: "최근 30일 관측 최저가를 갱신했습니다.",
  LOWEST_90D: "최근 90일 관측 최저가를 갱신했습니다.",
  NEAR_ALL_TIME_LOW: "전체 관측 최저가에 근접한 가격입니다.",
  RAPID_DROP: "직전 가격에서 단기간에 크게 하락했습니다.",
};

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getUtcDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function detectAndPersistOfferDeals(
  tx: Prisma.TransactionClient,
  input: {
    averagePrice: number;
    checkedAt: Date;
    confidence: DataConfidence;
    currentPrice: number;
    history: Array<{ checkedAt: Date; price: number }>;
    highDealScore: number;
    /** Score floor for candidate activation. Comes from config.thresholds.deal. */
    dealScoreThreshold: number;
    offerId: string;
    previousPrice?: number;
    score: number;
    title: string;
  },
) {
  const events = detectDealEvents(input, {
    ...DEFAULT_DEAL_DETECTION_CONFIG,
    highDealScore: input.highDealScore,
  });
  const dateKey = getUtcDateKey(input.checkedAt);
  const expiresAt = new Date(input.checkedAt.getTime() + HOT_DEAL_LIFETIME_MS);
  const storedEvents = await Promise.all(
    events.map((event) => {
      const fingerprint = digest(
        [
          input.offerId,
          event.type,
          input.currentPrice,
          dateKey,
        ].join(":"),
      );

      return tx.dealEvent.upsert({
        create: {
          detectedAt: input.checkedAt,
          evidence: event.evidence,
          expiresAt,
          fingerprint,
          offerId: input.offerId,
          referencePrice: event.referencePrice,
          score: input.score,
          triggerPrice: input.currentPrice,
          eventType: event.type,
        },
        update: {
          evidence: event.evidence,
          expiresAt,
          referencePrice: event.referencePrice,
          score: input.score,
        },
        where: { fingerprint },
      });
    }),
  );
  // Two-tier activation. The old single rule (score >= special with any
  // non-COLLECTING confidence) was unsatisfiable for PRELIMINARY data, whose
  // score cap sits below the special threshold - so nothing ever activated.
  const activationTier = getDealActivationTier({
    candidateThreshold: input.dealScoreThreshold,
    confidence: input.confidence,
    confirmedThreshold: input.highDealScore,
    score: input.score,
  });
  const canActivate = activationTier !== null;

  if (!canActivate) {
    await tx.deal.updateMany({
      data: { expiresAt: input.checkedAt, status: "EXPIRED" },
      where: { offerId: input.offerId, status: "ACTIVE" },
    });

    return { deal: null, events: storedEvents };
  }

  const primaryEvent = [...storedEvents].sort(
    (left, right) =>
      (EVENT_PRIORITY[right.eventType as DealEventType] ?? 0) -
      (EVENT_PRIORITY[left.eventType as DealEventType] ?? 0),
  )[0];

  if (!primaryEvent) return { deal: null, events: storedEvents };

  const primaryType = primaryEvent.eventType as DealEventType;
  const dedupeKey = digest(`${input.offerId}:hot-deal:${dateKey}`);
  const rankScore = input.score + EVENT_PRIORITY[primaryType];
  const deal = await tx.deal.upsert({
    create: {
      activatedAt: input.checkedAt,
      dedupeKey,
      expiresAt,
      headline: input.title,
      offerId: input.offerId,
      primaryEventId: primaryEvent.id,
      rankScore,
      score: input.score,
      startsAt: input.checkedAt,
      status: "ACTIVE",
      summary: EVENT_SUMMARY[primaryType],
    },
    update: {
      activatedAt: input.checkedAt,
      expiresAt,
      headline: input.title,
      primaryEventId: primaryEvent.id,
      rankScore,
      score: input.score,
      status: "ACTIVE",
      summary: EVENT_SUMMARY[primaryType],
    },
    where: { dedupeKey },
  });

  return { deal, events: storedEvents };
}
