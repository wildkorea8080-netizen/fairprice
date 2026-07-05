import type {
  CoupangDiscoverySource,
  CoupangProduct,
} from "@/lib/coupang/types";
import {
  normalizeCoupangProduct,
  type ImportedProductCandidate,
} from "@/lib/coupang/normalize";

export const coupangBestCategories = [
  { id: 1012, name: "식품" },
  { id: 1014, name: "생활용품" },
  { id: 1016, name: "가전디지털" },
  { id: 1010, name: "뷰티" },
  { id: 1011, name: "출산유아" },
  { id: 1013, name: "주방용품" },
  { id: 1017, name: "스포츠레저" },
  { id: 1020, name: "완구취미" },
  { id: 1024, name: "헬스건강식품" },
] as const;

export type DiscoveredProduct = ImportedProductCandidate & {
  discoveryScore: number;
  rank: number;
  source: CoupangDiscoverySource;
};

function calculateDiscoveryScore(
  product: CoupangProduct,
  source: CoupangDiscoverySource,
) {
  const rank = Math.max(product.rank || 100, 1);
  const sourceScore = source === "goldbox" ? 70 : 50;
  const rankScore = Math.max(30 - rank, 0);
  const shippingScore =
    (product.isRocket ? 8 : 0) + (product.isFreeShipping ? 4 : 0);

  return Math.min(sourceScore + rankScore + shippingScore, 100);
}

export function normalizeDiscoveredProducts(
  products: CoupangProduct[],
  source: CoupangDiscoverySource,
) {
  return products
    .map<DiscoveredProduct>((product, index) => ({
      ...normalizeCoupangProduct(product),
      discoveryScore: calculateDiscoveryScore(product, source),
      rank: product.rank || index + 1,
      source,
    }))
    .sort(
      (a, b) =>
        b.discoveryScore - a.discoveryScore ||
        a.rank - b.rank ||
        a.price - b.price,
    );
}
