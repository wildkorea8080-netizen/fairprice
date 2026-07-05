import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type AdminProductStatusFilter = "active" | "hidden" | "all";

export async function getAdminProductOverview({
  status = "active",
}: {
  status?: AdminProductStatusFilter;
} = {}) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const where =
    status === "all"
      ? {}
      : {
          isActive: status === "active",
        };

  const [active, hidden, featured, products] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: false } }),
    prisma.product.count({ where: { isActive: true, isFeatured: true } }),
    prisma.product.findMany({
      include: {
        adminNotes: {
          include: { adminUser: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        category: true,
        priceHistories: {
          orderBy: { checkedAt: "desc" },
          take: 2,
        },
      },
      orderBy: [
        { isFeatured: "desc" },
        { discountRate: "desc" },
        { updatedAt: "desc" },
      ],
      take: 100,
      where,
    }),
  ]);

  return {
    active,
    featured,
    hidden,
    products,
  };
}
