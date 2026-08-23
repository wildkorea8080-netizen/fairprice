export const DEAL_ENTITY_TYPES = {
  shoppingProduct: "SHOPPING_PRODUCT",
} as const;

export type DealEntityType =
  (typeof DEAL_ENTITY_TYPES)[keyof typeof DEAL_ENTITY_TYPES]
  | (string & {});

export type DealEntity = {
  canonicalKey: string;
  entityType: DealEntityType;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  title: string;
};
