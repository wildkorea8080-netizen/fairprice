import type { DealProduct } from "@/lib/deal-products";

export function stringifyJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function createBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      item: item.url,
      name: item.name,
      position: index + 1,
    })),
  };
}

export function createWebSiteJsonLd({
  description,
  name,
  url,
}: {
  description: string;
  name: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description,
    name,
    potentialAction: {
      "@type": "SearchAction",
      query: "required name=search_term_string",
      target: `${url}/deals?q={search_term_string}`,
    },
    url,
  };
}

export function createProductItemListJsonLd({
  products,
  url,
}: {
  products: DealProduct[];
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.slice(0, 30).map((product, index) => ({
      "@type": "ListItem",
      item: `${url.split("/").slice(0, 3).join("/")}/products/${product.slug}`,
      name: product.title,
      position: index + 1,
    })),
    numberOfItems: products.length,
    url,
  };
}
