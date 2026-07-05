export type CoupangProduct = {
  categoryName?: string;
  isFreeShipping?: boolean;
  isRocket?: boolean;
  itemId?: number;
  keyword?: string;
  productId: number;
  productImage: string;
  productName: string;
  productPrice: number;
  productUrl: string;
  rank?: number;
  vendorItemId?: number;
};

export type CoupangSearchResult = {
  products: CoupangProduct[];
  requestId?: string;
};

export type CoupangDiscoverySource = "category" | "goldbox";

export type CoupangDeeplink = {
  landingUrl: string;
  originalUrl: string;
  shortenUrl?: string;
};
