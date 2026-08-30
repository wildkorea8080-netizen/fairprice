import "server-only";

import { prisma } from "@/lib/prisma";

export type AnnounceableDeal = {
  discountRate: number;
  headline: string | null;
  id: string;
  price: number;
  productId: string;
  slug: string;
  title: string;
};

/**
 * Finds active deals whose given announcement stamp is still null and resolves
 * each to its shopping product. Shared by the browser-push and Telegram steps,
 * which differ only in the stamp column and the delivery call.
 *
 * Deals whose offer has no shopping product behind it are stamped immediately
 * through onUnresolvable, because they can never be announced and leaving them
 * unstamped would make every later run re-examine them forever.
 */
export async function getUnannouncedDeals(
  stampField: "pushedAt" | "telegramPostedAt",
  batch: number,
  onUnresolvable: (dealId: string) => Promise<void>,
): Promise<AnnounceableDeal[]> {
  const now = new Date();
  const deals = await prisma.deal.findMany({
    include: {
      offer: {
        include: {
          dealEntity: {
            include: { shoppingVariant: { select: { productId: true } } },
          },
        },
      },
    },
    orderBy: { rankScore: "desc" },
    take: batch,
    where: {
      [stampField]: null,
      startsAt: { lte: now },
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  const resolved: AnnounceableDeal[] = [];

  for (const deal of deals) {
    const productId = deal.offer.dealEntity.shoppingVariant?.productId;
    const product = productId
      ? await prisma.product.findUnique({
          select: {
            currentPrice: true,
            discountRate: true,
            slug: true,
            title: true,
          },
          where: { id: productId },
        })
      : null;

    if (!productId || !product) {
      await onUnresolvable(deal.id);
      continue;
    }

    resolved.push({
      discountRate: product.discountRate,
      headline: deal.headline,
      id: deal.id,
      price: product.currentPrice,
      productId,
      slug: product.slug,
      title: product.title,
    });
  }

  return resolved;
}
