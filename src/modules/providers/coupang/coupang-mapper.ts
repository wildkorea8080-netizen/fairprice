import { DEAL_ENTITY_TYPES } from "@/modules/deal-engine/domain/entity";
import type { PriceSnapshot } from "@/modules/deal-engine/domain/price-snapshot";
import type { SourceCandidate } from "@/modules/deal-engine/ports/source-provider";
import type { ImportedProductCandidate } from "@/lib/coupang/normalize";

export const COUPANG_SOURCE = "COUPANG";

export function mapCoupangCandidate(
  product: ImportedProductCandidate,
  options: { rank?: number; sourceScore?: number } = {},
): SourceCandidate {
  return {
    entity: {
      canonicalKey: `coupang:${product.externalProductKey}`,
      entityType: DEAL_ENTITY_TYPES.shoppingProduct,
      imageUrl: product.imageUrl,
      metadata: {
        categoryName: product.categoryName,
      },
      title: product.title,
    },
    offer: {
      affiliateUrl: product.partnerUrl,
      availability: "AVAILABLE",
      currency: "KRW",
      entityCanonicalKey: `coupang:${product.externalProductKey}`,
      externalKey: product.externalProductKey,
      metadata: {
        categoryName: product.categoryName,
        coupangItemId: product.itemId,
        coupangProductId: product.productId,
        coupangVendorItemId: product.vendorItemId,
        isFreeShipping: product.isFreeShipping,
        isRocket: product.isRocket,
      },
      source: COUPANG_SOURCE,
      sourceUrl: product.partnerUrl,
    },
    rank: options.rank,
    sourceScore: options.sourceScore,
  };
}

export function mapCoupangSnapshot(
  product: ImportedProductCandidate,
  checkedAt: Date,
  requestId?: string,
): PriceSnapshot {
  return {
    affiliateUrl: product.partnerUrl,
    availability: "AVAILABLE",
    checkedAt,
    currency: "KRW",
    externalOfferKey: product.externalProductKey,
    metadata: {
      categoryName: product.categoryName,
      isFreeShipping: product.isFreeShipping,
      isRocket: product.isRocket,
    },
    originalPrice: product.price,
    price: product.price,
    requestId,
    source: COUPANG_SOURCE,
    status: "SUCCESS",
  };
}
