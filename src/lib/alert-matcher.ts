import type { Product } from "@/data/catalog";
import type { KeywordAlert } from "@/lib/preferences";

export type AlertMatch = {
  alert: KeywordAlert;
  products: Product[];
};

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function getSearchableProductText(product: Product) {
  return normalizeSearchText(
    [
      product.title,
      product.brand,
      product.category.name,
      product.category.description,
      product.description,
    ].join(" "),
  );
}

export function doesProductMatchAlert(product: Product, alert: KeywordAlert) {
  const keyword = normalizeSearchText(alert.keyword);

  if (!keyword || !getSearchableProductText(product).includes(keyword)) {
    return false;
  }

  if (alert.minDiscountRate !== undefined && product.discountRate < alert.minDiscountRate) {
    return false;
  }

  if (alert.maxPrice !== undefined && product.price > alert.maxPrice) {
    return false;
  }

  return true;
}

export function matchProductsToAlerts(allProducts: Product[], alerts: KeywordAlert[]) {
  return alerts.map<AlertMatch>((alert) => ({
    alert,
    products: allProducts
      .filter((product) => doesProductMatchAlert(product, alert))
      .sort((a, b) => b.discountRate - a.discountRate || a.price - b.price),
  }));
}

export function getUniqueMatchedProducts(matches: AlertMatch[]) {
  return Array.from(
    new Map(
      matches.flatMap((match) => match.products).map((product) => [product.slug, product]),
    ).values(),
  ).sort((a, b) => b.discountRate - a.discountRate || a.price - b.price);
}
