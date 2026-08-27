let counter = 0;

function nextSuffix() {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

export async function createCategory(prisma, overrides = {}) {
  const suffix = nextSuffix();

  return prisma.category.create({
    data: {
      name: `테스트 카테고리 ${suffix}`,
      slug: `test-category-${suffix}`,
      ...overrides,
    },
  });
}

export async function createUser(prisma, overrides = {}) {
  const suffix = nextSuffix();

  return prisma.user.create({
    data: {
      email: `tester-${suffix}@example.test`,
      name: `테스터 ${suffix}`,
      ...overrides,
    },
  });
}

export async function createProduct(prisma, { categoryId, ...overrides } = {}) {
  const suffix = nextSuffix();
  const currentPrice = overrides.currentPrice ?? 10000;
  const originalPrice = overrides.originalPrice ?? 20000;

  return prisma.product.create({
    data: {
      categoryId,
      coupangUrl: `https://www.coupang.com/vp/products/${suffix}`,
      currentPrice,
      discountRate:
        overrides.discountRate ??
        Math.round(((originalPrice - currentPrice) / originalPrice) * 100),
      originalPrice,
      partnerUrl: `https://link.coupang.com/a/${suffix}`,
      slug: `test-product-${suffix}`,
      title: `테스트 상품 ${suffix}`,
      ...overrides,
    },
  });
}

/**
 * Writes price history oldest-first. The evaluator reads the two newest rows
 * and treats index 1 as the previous observation, so the order matters.
 */
export async function addPriceHistory(prisma, productId, entries) {
  for (const entry of entries) {
    await prisma.productPriceHistory.create({
      data: {
        checkedAt: entry.checkedAt,
        discountRate: entry.discountRate ?? 0,
        originalPrice: entry.originalPrice ?? 20000,
        price: entry.price,
        productId,
      },
    });
  }
}

export async function createAlertRule(prisma, { userId, ...overrides } = {}) {
  return prisma.alertRule.create({
    data: {
      userId,
      ...overrides,
    },
  });
}
