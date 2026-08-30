export type PushCandidate = {
  keyword: string | null;
  maxPrice: number | null;
  productId: string | null;
};

export type PushDeal = {
  price: number;
  productId: string;
  title: string;
};

/**
 * Decides whether one subscription should receive one deal.
 *
 * A subscription always names something to watch - normalizePushSubscription
 * refuses one that names neither - so this never matches everything. A product
 * subscription is exact; a keyword subscription matches on the product title,
 * which is what the subscriber was looking at when they subscribed.
 *
 * maxPrice is a ceiling, not a filter to be ignored when absent: someone who
 * asked to hear at 9,900원 does not want a notification at 12,000원, and one
 * unwanted push is enough to lose the permission for every later one.
 */
export function shouldPushDeal(
  candidate: PushCandidate,
  deal: PushDeal,
): boolean {
  if (candidate.maxPrice !== null && deal.price > candidate.maxPrice) {
    return false;
  }

  if (candidate.productId) {
    return candidate.productId === deal.productId;
  }

  if (candidate.keyword) {
    return matchesKeyword(deal.title, candidate.keyword);
  }

  return false;
}

/**
 * Every whitespace-separated term must appear. "무선 이어폰" should not match a
 * wireless kettle just because it shares one word.
 */
export function matchesKeyword(title: string, keyword: string) {
  const haystack = title.toLocaleLowerCase("ko-KR");
  const terms = keyword
    .toLocaleLowerCase("ko-KR")
    .split(/\s+/)
    .filter(Boolean);

  return terms.length > 0 && terms.every((term) => haystack.includes(term));
}
