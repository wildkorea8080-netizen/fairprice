export type PriceGapDirection = "above" | "below" | "same";

export type PriceGap = {
  amount: number;
  direction: PriceGapDirection;
  /** Ready-to-render sentence, e.g. "관측 평균가보다 3,200원 쌉니다". */
  text: string;
};

const WON_FORMATTER = new Intl.NumberFormat("ko-KR");

/**
 * Prices in won rather than a percentage. "평균보다 12% 낮음" needs arithmetic
 * before it means anything; "평균가보다 3,200원 쌉니다" is the number a shopper
 * is already trying to work out.
 */
export function describePriceGap(
  currentPrice: number,
  referencePrice: number,
  referenceLabel: string,
): PriceGap {
  const difference = Math.round(currentPrice - referencePrice);
  const amount = Math.abs(difference);

  if (!Number.isFinite(difference) || amount === 0) {
    return { amount: 0, direction: "same", text: `${referenceLabel}와 같습니다` };
  }

  const formatted = `${WON_FORMATTER.format(amount)}원`;

  return difference < 0
    ? {
        amount,
        direction: "below",
        text: `${referenceLabel}보다 ${formatted} 쌉니다`,
      }
    : {
        amount,
        direction: "above",
        text: `${referenceLabel}보다 ${formatted} 비쌉니다`,
      };
}
