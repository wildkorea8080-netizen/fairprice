import assert from "node:assert/strict";
import {
  addPriceHistory,
  createAlertRule,
  createCategory,
  createProduct,
  createUser,
} from "./seed.mjs";

const HOUR = 60 * 60 * 1000;

/**
 * Covers evaluateAlertRules against a real database. The unit tests cover the
 * decision function; what is untested is whether the evaluator feeds it the
 * right previous observation and writes the queue row. This is the path that
 * puts mail in front of members, so a wrong read here is a wrong email.
 */
export async function run(prisma) {
  const { evaluateAlertRules } = await import("@/lib/alert-evaluator");

  async function scenario(name, build) {
    const category = await createCategory(prisma);
    const user = await createUser(prisma);
    const context = { category, prisma, user };

    await build(context);

    const summary = await evaluateAlertRules();
    const logs = await prisma.notificationLog.findMany({
      where: { userId: user.id },
    });

    return { logs, name, summary };
  }

  // Entering the condition for the first time queues one notification.
  {
    const result = await scenario("first entry", async ({ category, user }) => {
      const product = await createProduct(prisma, {
        categoryId: category.id,
        currentPrice: 8000,
        originalPrice: 20000,
      });

      await addPriceHistory(prisma, product.id, [
        { checkedAt: new Date(Date.now() - 2 * HOUR), price: 15000 },
        { checkedAt: new Date(Date.now() - HOUR), price: 8000 },
      ]);

      await createAlertRule(prisma, { maxPrice: 10000, userId: user.id });
    });

    assert.equal(result.summary.created, 1, "first entry should queue mail");
    assert.equal(result.logs.length, 1);
    assert.equal(result.logs[0].status, "PENDING");
  }

  // Already under the target at the previous observation: nothing new happened.
  {
    const result = await scenario("continuation", async ({ category, user }) => {
      const product = await createProduct(prisma, {
        categoryId: category.id,
        currentPrice: 8000,
        originalPrice: 20000,
      });

      await addPriceHistory(prisma, product.id, [
        { checkedAt: new Date(Date.now() - 2 * HOUR), price: 8500 },
        { checkedAt: new Date(Date.now() - HOUR), price: 8000 },
      ]);

      await createAlertRule(prisma, { maxPrice: 10000, userId: user.id });
    });

    assert.equal(result.summary.created, 0, "a continuing deal must not requeue");
    assert.equal(result.summary.skippedDuplicates, 1);
    assert.equal(result.logs.length, 0);
  }

  // Re-entry inside the cooldown is suppressed.
  {
    const result = await scenario("cooldown", async ({ category, user }) => {
      const product = await createProduct(prisma, {
        categoryId: category.id,
        currentPrice: 8000,
        originalPrice: 20000,
      });

      await addPriceHistory(prisma, product.id, [
        { checkedAt: new Date(Date.now() - 2 * HOUR), price: 15000 },
        { checkedAt: new Date(Date.now() - HOUR), price: 8000 },
      ]);

      const rule = await createAlertRule(prisma, {
        maxPrice: 10000,
        userId: user.id,
      });

      await prisma.notificationLog.create({
        data: {
          alertRuleId: rule.id,
          createdAt: new Date(Date.now() - 2 * HOUR),
          productId: product.id,
          status: "SENT",
          subject: "이전 알림",
          userId: user.id,
        },
      });
    });

    assert.equal(result.summary.created, 0, "cooldown must suppress re-entry");
    assert.equal(result.summary.skippedCooldown, 1);
    assert.equal(result.logs.length, 1, "only the pre-existing log remains");
  }

  // Re-entry after the cooldown window queues again.
  {
    const result = await scenario("after cooldown", async ({ category, user }) => {
      const product = await createProduct(prisma, {
        categoryId: category.id,
        currentPrice: 8000,
        originalPrice: 20000,
      });

      await addPriceHistory(prisma, product.id, [
        { checkedAt: new Date(Date.now() - 2 * HOUR), price: 15000 },
        { checkedAt: new Date(Date.now() - HOUR), price: 8000 },
      ]);

      const rule = await createAlertRule(prisma, {
        maxPrice: 10000,
        userId: user.id,
      });

      await prisma.notificationLog.create({
        data: {
          alertRuleId: rule.id,
          createdAt: new Date(Date.now() - 40 * HOUR),
          productId: product.id,
          status: "SENT",
          subject: "오래된 알림",
          userId: user.id,
        },
      });
    });

    assert.equal(result.summary.created, 1, "past the cooldown it must queue");
    assert.equal(result.logs.length, 2);
  }

  // A deactivated rule is ignored entirely - this is what /unsubscribe sets.
  {
    const result = await scenario("inactive rule", async ({ category, user }) => {
      const product = await createProduct(prisma, {
        categoryId: category.id,
        currentPrice: 8000,
        originalPrice: 20000,
      });

      await addPriceHistory(prisma, product.id, [
        { checkedAt: new Date(Date.now() - 2 * HOUR), price: 15000 },
        { checkedAt: new Date(Date.now() - HOUR), price: 8000 },
      ]);

      await createAlertRule(prisma, {
        isActive: false,
        maxPrice: 10000,
        userId: user.id,
      });
    });

    assert.equal(result.summary.rules, 0, "unsubscribed rules must not evaluate");
    assert.equal(result.logs.length, 0);
  }

  // A price above the target never matches.
  {
    const result = await scenario("no match", async ({ category, user }) => {
      const product = await createProduct(prisma, {
        categoryId: category.id,
        currentPrice: 15000,
        originalPrice: 20000,
      });

      await addPriceHistory(prisma, product.id, [
        { checkedAt: new Date(Date.now() - 2 * HOUR), price: 18000 },
        { checkedAt: new Date(Date.now() - HOUR), price: 15000 },
      ]);

      await createAlertRule(prisma, { maxPrice: 10000, userId: user.id });
    });

    assert.equal(result.summary.matched, 0);
    assert.equal(result.logs.length, 0);
  }
}
