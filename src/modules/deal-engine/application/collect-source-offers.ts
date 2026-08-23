import type {
  SourceCollectionResult,
  SourceDiscoveryRequest,
  SourceProvider,
} from "@/modules/deal-engine/ports/source-provider";

export async function collectSourceOffers(
  provider: SourceProvider,
  request: SourceDiscoveryRequest,
): Promise<SourceCollectionResult> {
  return provider.collect(request);
}
