import type { DealEntity } from "@/modules/deal-engine/domain/entity";
import type { DealOffer } from "@/modules/deal-engine/domain/offer";
import type { PriceSnapshot } from "@/modules/deal-engine/domain/price-snapshot";

export type SourceDiscoveryRequest =
  | { kind: "CATEGORY"; categoryId: string; limit?: number }
  | { kind: "POPULAR"; limit?: number }
  | { kind: "SEARCH"; keyword: string; limit?: number };

export type SourceCandidate = {
  entity: DealEntity;
  offer: DealOffer;
  rank?: number;
  sourceScore?: number;
};

export type SourceCollectionResult = {
  candidates: SourceCandidate[];
  requestId?: string;
  snapshots: PriceSnapshot[];
};

export interface SourceProvider {
  readonly source: string;
  collect(request: SourceDiscoveryRequest): Promise<SourceCollectionResult>;
  discover(request: SourceDiscoveryRequest): Promise<SourceCandidate[]>;
}
