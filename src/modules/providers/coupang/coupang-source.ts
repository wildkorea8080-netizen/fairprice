import {
  getCoupangBestCategoryProducts,
  getCoupangGoldboxProducts,
  searchCoupangProducts,
} from "@/lib/coupang/client";
import {
  normalizeDiscoveredProducts,
} from "@/lib/coupang/discovery";
import { normalizeCoupangProduct } from "@/lib/coupang/normalize";
import type { CoupangProduct } from "@/lib/coupang/types";
import type {
  SourceCollectionResult,
  SourceDiscoveryRequest,
  SourceProvider,
} from "@/modules/deal-engine/ports/source-provider";
import {
  COUPANG_SOURCE,
  mapCoupangCandidate,
  mapCoupangSnapshot,
} from "@/modules/providers/coupang/coupang-mapper";

const DEFAULT_LIMIT = 20;

async function fetchProducts(request: SourceDiscoveryRequest) {
  if (request.kind === "POPULAR") {
    return getCoupangGoldboxProducts();
  }

  if (request.kind === "CATEGORY") {
    const categoryId = Number(request.categoryId);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new Error("쿠팡 카테고리 ID는 양의 정수여야 합니다.");
    }

    return getCoupangBestCategoryProducts(
      categoryId,
      request.limit ?? DEFAULT_LIMIT,
    );
  }

  return searchCoupangProducts(request.keyword, request.limit ?? DEFAULT_LIMIT);
}

function toCandidates(
  products: CoupangProduct[],
  request: SourceDiscoveryRequest,
) {
  if (request.kind === "POPULAR") {
    return normalizeDiscoveredProducts(products, "goldbox").map((product) =>
      mapCoupangCandidate(product, {
        rank: product.rank,
        sourceScore: product.discoveryScore,
      }),
    );
  }

  if (request.kind === "CATEGORY") {
    return normalizeDiscoveredProducts(products, "category").map((product) =>
      mapCoupangCandidate(product, {
        rank: product.rank,
        sourceScore: product.discoveryScore,
      }),
    );
  }

  return products.map((product, index) =>
    mapCoupangCandidate(normalizeCoupangProduct(product), {
      rank: product.rank ?? index + 1,
    }),
  );
}

export class CoupangSourceProvider implements SourceProvider {
  readonly source = COUPANG_SOURCE;

  async collect(
    request: SourceDiscoveryRequest,
  ): Promise<SourceCollectionResult> {
    const result = await fetchProducts(request);
    const checkedAt = new Date();
    const normalized = result.products.map(normalizeCoupangProduct);

    return {
      candidates: toCandidates(result.products, request),
      requestId: result.requestId,
      snapshots: normalized.map((product) =>
        mapCoupangSnapshot(product, checkedAt, result.requestId),
      ),
    };
  }

  async discover(request: SourceDiscoveryRequest) {
    const result = await fetchProducts(request);

    return toCandidates(result.products, request);
  }
}
