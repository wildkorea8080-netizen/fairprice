import type { CoupangProduct } from "@/lib/coupang/types";

export type ImportedProductCandidate = {
  categoryName: string;
  externalProductKey: string;
  imageUrl: string;
  isFreeShipping: boolean;
  isRocket: boolean;
  itemId?: string;
  partnerUrl: string;
  price: number;
  productId: string;
  title: string;
  vendorItemId?: string;
};

export function normalizeCoupangProduct(
  product: CoupangProduct,
): ImportedProductCandidate {
  return {
    categoryName: product.categoryName || "미분류",
    externalProductKey: [
      product.productId,
      product.itemId ?? "item",
      product.vendorItemId ?? "vendor",
    ].join(":"),
    imageUrl: product.productImage,
    isFreeShipping: Boolean(product.isFreeShipping),
    isRocket: Boolean(product.isRocket),
    itemId: product.itemId ? String(product.itemId) : undefined,
    partnerUrl: product.productUrl,
    price: product.productPrice,
    productId: String(product.productId),
    title: product.productName.trim(),
    vendorItemId: product.vendorItemId
      ? String(product.vendorItemId)
      : undefined,
  };
}
