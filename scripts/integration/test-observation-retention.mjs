import assert from "node:assert/strict";

const DAY = 86_400_000;

/**
 * Covers cleanupExpiredObservations against a real schema. This code deletes
 * rows, so the test proves the guarantees the policy demands: an expired
 * successful observation goes only when its day is aggregated, an expired one
 * without coverage is kept and reported, diagnostics go unconditionally, and
 * nothing inside the retention window is touched at all.
 */
export async function run(prisma) {
  const { cleanupExpiredObservations } = await import(
    "@/lib/observation-retention"
  );

  const now = new Date();
  const oldDate = new Date(now.getTime() - 120 * DAY);
  const oldDay = new Date(oldDate.toISOString().slice(0, 10));
  const category = await prisma.category.create({
    data: { name: "테스트", slug: `ret-cat-${Date.now()}` },
  });
  const group = await prisma.productGroup.create({
    data: {
      categoryId: category.id,
      slug: `ret-group-${Date.now()}`,
      title: "리텐션 테스트 그룹",
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      externalKey: `ret-variant-${Date.now()}`,
      productGroupId: group.id,
    },
  });
  const entity = await prisma.dealEntity.create({
    data: {
      canonicalKey: `ret-entity-${Date.now()}`,
      entityType: "SHOPPING_PRODUCT",
      title: "리텐션 테스트",
    },
  });
  const offer = await prisma.offer.create({
    data: {
      dealEntityId: entity.id,
      externalKey: `ret-offer-${Date.now()}`,
      source: "COUPANG",
      sourceUrl: "https://example.test",
    },
  });

  // The aggregate that licenses deletion, for exactly one old day.
  await prisma.dailyPriceAggregate.create({
    data: {
      availableCount: 1,
      closePrice: 1000,
      date: oldDay,
      highestPrice: 1000,
      lastObservedAt: oldDate,
      lowestPrice: 1000,
      medianPrice: 1000,
      offerId: offer.id,
      openPrice: 1000,
      sampleCount: 1,
    },
  });

  const base = {
    offerId: offer.id,
    price: 1000,
    productVariantId: variant.id,
  };

  const [covered, uncovered, failure, anomaly, recent] = await Promise.all([
    // Expired, priced, aggregated day -> must be deleted.
    prisma.priceObservation.create({
      data: { ...base, checkedAt: oldDate, status: "SUCCESS" },
    }),
    // Expired, priced, but its day has no aggregate -> must be KEPT.
    prisma.priceObservation.create({
      data: {
        ...base,
        checkedAt: new Date(oldDate.getTime() - 10 * DAY),
        status: "SUCCESS",
      },
    }),
    // Expired failure -> diagnostics, deleted unconditionally.
    prisma.priceObservation.create({
      data: {
        ...base,
        checkedAt: oldDate,
        errorCode: "TIMEOUT",
        price: null,
        status: "FAILED",
      },
    }),
    // Expired anomaly -> same.
    prisma.priceObservation.create({
      data: { ...base, checkedAt: oldDate, isAnomaly: true, status: "SUCCESS" },
    }),
    // Fresh observation -> untouchable regardless of anything else.
    prisma.priceObservation.create({
      data: { ...base, checkedAt: new Date(now.getTime() - DAY), status: "SUCCESS" },
    }),
  ]);

  const summary = await cleanupExpiredObservations({ now });

  assert.equal(summary.deletedCovered, 1, "aggregated old success deleted");
  assert.equal(summary.deletedDiagnostics, 2, "failure and anomaly deleted");
  assert.equal(summary.keptUncovered, 1, "uncovered old success reported");

  const remaining = await prisma.priceObservation.findMany({
    select: { id: true },
    where: { productVariantId: variant.id },
  });
  const remainingIds = new Set(remaining.map(({ id }) => id));

  assert.ok(!remainingIds.has(covered.id), "covered row gone");
  assert.ok(!remainingIds.has(failure.id), "failure row gone");
  assert.ok(!remainingIds.has(anomaly.id), "anomaly row gone");
  assert.ok(remainingIds.has(uncovered.id), "uncovered row survives");
  assert.ok(remainingIds.has(recent.id), "recent row survives");

  // Idempotent: a second run finds the same uncovered row and nothing new.
  const again = await cleanupExpiredObservations({ now });
  assert.equal(again.deletedCovered, 0);
  assert.equal(again.deletedDiagnostics, 0);
  assert.equal(again.keptUncovered, 1);
}
