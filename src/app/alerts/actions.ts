"use server";

import { redirect } from "next/navigation";
import { products } from "@/data/catalog";
import { matchProductsToAlerts } from "@/lib/alert-matcher";
import { requireUser } from "@/lib/auth";
import {
  createDeliveryRecords,
  getPendingNotificationMessages,
} from "@/lib/notifications";
import { getUserPreferences, setUserPreferences } from "@/lib/preferences";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { ensureDatabaseUser } from "@/lib/users";

function positiveNumber(value: FormDataEntryValue | null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}

function discountRate(value: FormDataEntryValue | null) {
  const number = positiveNumber(value);
  return number !== undefined && number <= 100 ? number : undefined;
}

export async function addFavoriteProduct(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const next = String(formData.get("next") ?? "/alerts");
  await requireUser(next);

  if (!slug) {
    redirect(next);
  }

  const preferences = await getUserPreferences();

  if (!preferences.favoriteProductSlugs.includes(slug)) {
    await setUserPreferences({
      ...preferences,
      favoriteProductSlugs: [slug, ...preferences.favoriteProductSlugs],
    });
  }

  redirect(`${next}?status=favorite-added`);
}

export async function removeFavoriteProduct(formData: FormData) {
  await requireUser("/alerts");
  const slug = String(formData.get("slug") ?? "").trim();
  const preferences = await getUserPreferences();

  await setUserPreferences({
    ...preferences,
    favoriteProductSlugs: preferences.favoriteProductSlugs.filter((item) => item !== slug),
  });

  redirect("/alerts?status=favorite-removed");
}

export async function addKeywordAlert(formData: FormData) {
  const user = await requireUser("/alerts");
  const keyword = String(formData.get("keyword") ?? "").trim().replace(/\s+/g, " ");
  const minDiscountRate = discountRate(formData.get("minDiscountRate"));
  const maxPrice = positiveNumber(formData.get("maxPrice"));

  if (!keyword) {
    redirect("/alerts?status=keyword-invalid");
  }

  const preferences = await getUserPreferences();
  const id = crypto.randomUUID();

  await setUserPreferences({
    ...preferences,
    keywordAlerts: [
      {
        id,
        keyword,
        maxPrice,
        minDiscountRate,
      },
      ...preferences.keywordAlerts,
    ],
  });

  if (isDatabaseConfigured()) {
    const databaseUser = await ensureDatabaseUser(user);

    if (databaseUser) {
      await prisma.alertRule.create({
        data: {
          id,
          keyword,
          maxPrice,
          minDiscountRate,
          userId: databaseUser.id,
        },
      });
    }
  }

  redirect("/alerts?status=keyword-added");
}

export async function addProductPriceAlert(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const maxPrice = positiveNumber(formData.get("maxPrice"));
  const minDiscountRate = discountRate(formData.get("minDiscountRate"));
  const next = String(formData.get("next") ?? (slug ? `/products/${slug}` : "/alerts"));
  const user = await requireUser(next);

  if (!slug || (!maxPrice && !minDiscountRate)) {
    redirect(`${next}?status=product-alert-invalid`);
  }

  if (!isDatabaseConfigured()) {
    redirect(`${next}?status=database-required`);
  }

  const [databaseUser, product] = await Promise.all([
    ensureDatabaseUser(user),
    prisma.product.findUnique({
      select: { id: true },
      where: { slug },
    }),
  ]);

  if (!databaseUser || !product) {
    redirect(`${next}?status=product-alert-missing`);
  }

  await prisma.alertRule.updateMany({
    data: { isActive: false },
    where: {
      isActive: true,
      productId: product.id,
      userId: databaseUser.id,
    },
  });

  await prisma.alertRule.create({
    data: {
      maxPrice,
      minDiscountRate,
      productId: product.id,
      userId: databaseUser.id,
    },
  });

  redirect(`${next}?status=product-alert-added`);
}

export async function removeKeywordAlert(formData: FormData) {
  await requireUser("/alerts");
  const id = String(formData.get("id") ?? "").trim();
  const preferences = await getUserPreferences();

  await setUserPreferences({
    ...preferences,
    keywordAlerts: preferences.keywordAlerts.filter((alert) => alert.id !== id),
  });

  if (isDatabaseConfigured() && id) {
    await prisma.alertRule.updateMany({
      data: { isActive: false },
      where: { id },
    });
  }

  redirect("/alerts?status=keyword-removed");
}

export async function removeProductPriceAlert(formData: FormData) {
  const user = await requireUser("/alerts");
  const id = String(formData.get("id") ?? "").trim();

  if (isDatabaseConfigured() && id) {
    const databaseUser = await ensureDatabaseUser(user);

    if (databaseUser) {
      await prisma.alertRule.updateMany({
        data: { isActive: false },
        where: {
          id,
          userId: databaseUser.id,
        },
      });
    }
  }

  redirect("/alerts?status=product-alert-removed");
}

export async function sendMatchedAlertTest() {
  const user = await requireUser("/alerts");
  const preferences = await getUserPreferences();
  const matches = matchProductsToAlerts(products, preferences.keywordAlerts);
  const messages = getPendingNotificationMessages(
    matches,
    preferences.notificationDeliveries,
  );

  if (messages.length === 0) {
    redirect("/alerts?status=notification-empty");
  }

  const deliveries = createDeliveryRecords(messages, user.email);

  await setUserPreferences({
    ...preferences,
    notificationDeliveries: [
      ...deliveries,
      ...preferences.notificationDeliveries,
    ].slice(0, 20),
  });

  redirect(`/alerts?status=notification-sent&count=${deliveries.length}`);
}
