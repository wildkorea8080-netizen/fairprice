export const KEYWORD_SEO_MIN_PRODUCTS = 1;

export type KeywordSeoCandidate = {
  keyword: string;
  productCount: number;
};

export type KeywordSeoEligibility = {
  eligible: boolean;
  reasons: Array<"no-products" | "thin-keyword">;
};

/**
 * A keyword page with no products carries two sentences of body text saying it
 * has nothing yet. Submitting a hundred of those to a search engine that has
 * indexed nothing from this domain teaches it the site is thin, and spends
 * crawl budget that the product pages need.
 *
 * The gate is deliberately the same shape as the product one: the page stays
 * reachable and keeps working, it just leaves the sitemap and asks not to be
 * indexed until it has something to show. Collection fills these in on its own,
 * so a page re-qualifies without anyone editing anything.
 */
export function getKeywordSeoEligibility(
  candidate: KeywordSeoCandidate,
): KeywordSeoEligibility {
  const reasons: KeywordSeoEligibility["reasons"] = [];
  const keyword = candidate.keyword.trim();

  if (keyword.length < 2) {
    reasons.push("thin-keyword");
  }

  if (candidate.productCount < KEYWORD_SEO_MIN_PRODUCTS) {
    reasons.push("no-products");
  }

  return { eligible: reasons.length === 0, reasons };
}
