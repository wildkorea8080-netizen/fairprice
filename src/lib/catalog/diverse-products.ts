type CatalogProduct = {
  category: { slug: string };
  slug: string;
  title: string;
};

function getProductFamilyKey(product: CatalogProduct) {
  const titleTokens = product.title
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .match(/[\p{L}]{2,}/gu)
    ?.sort() ?? [];
  const titleKey = titleTokens.length > 0
    ? titleTokens.join("|")
    : product.title.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();

  return `${product.category.slug}:${titleKey}`;
}

export function getProductDedupeKeys(product: CatalogProduct) {
  return [`slug:${product.slug}`, `family:${getProductFamilyKey(product)}`];
}

export function createProductDedupeSet(products: CatalogProduct[] = []) {
  return new Set(products.flatMap(getProductDedupeKeys));
}

export function selectDiverseProducts<T extends CatalogProduct>({
  excludedKeys = new Set<string>(),
  limit,
  products,
}: {
  excludedKeys?: Set<string>;
  limit: number;
  products: T[];
}) {
  if (limit <= 0) return [];

  const selected: T[] = [];
  const seenKeys = new Set(excludedKeys);
  const categoryQueues = new Map<string, T[]>();

  for (const product of products) {
    const keys = getProductDedupeKeys(product);
    if (keys.some((key) => seenKeys.has(key))) continue;

    keys.forEach((key) => seenKeys.add(key));
    const queue = categoryQueues.get(product.category.slug) ?? [];
    queue.push(product);
    categoryQueues.set(product.category.slug, queue);
  }

  const queues = [...categoryQueues.values()];
  let round = 0;

  while (selected.length < limit && queues.some((queue) => round < queue.length)) {
    for (const queue of queues) {
      const product = queue[round];
      if (product) selected.push(product);
      if (selected.length === limit) break;
    }
    round += 1;
  }

  return selected;
}
