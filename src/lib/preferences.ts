import { cookies } from "next/headers";

export type KeywordAlert = {
  id: string;
  keyword: string;
  maxPrice?: number;
  minDiscountRate?: number;
};

export type NotificationDelivery = {
  alertId: string;
  id: string;
  productSlug: string;
  recipient: string;
  sentAt: string;
  subject: string;
};

export type UserPreferences = {
  favoriteProductSlugs: string[];
  keywordAlerts: KeywordAlert[];
  notificationDeliveries: NotificationDelivery[];
};

const PREFERENCES_COOKIE = "fairprice_preferences";

const emptyPreferences: UserPreferences = {
  favoriteProductSlugs: [],
  keywordAlerts: [],
  notificationDeliveries: [],
};

function encodePreferences(preferences: UserPreferences) {
  return Buffer.from(JSON.stringify(preferences), "utf8").toString("base64url");
}

function decodePreferences(value: string): UserPreferences {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as UserPreferences;

    return {
      favoriteProductSlugs: Array.isArray(parsed.favoriteProductSlugs)
        ? parsed.favoriteProductSlugs.filter(Boolean)
        : [],
      keywordAlerts: Array.isArray(parsed.keywordAlerts)
        ? parsed.keywordAlerts.filter((alert) => alert.id && alert.keyword)
        : [],
      notificationDeliveries: Array.isArray(parsed.notificationDeliveries)
        ? parsed.notificationDeliveries.filter(
            (delivery) =>
              delivery.id &&
              delivery.alertId &&
              delivery.productSlug &&
              delivery.recipient &&
              delivery.sentAt &&
              delivery.subject,
          )
        : [],
    };
  } catch {
    return emptyPreferences;
  }
}

export async function getUserPreferences() {
  const cookieStore = await cookies();
  const value = cookieStore.get(PREFERENCES_COOKIE)?.value;

  if (!value) {
    return emptyPreferences;
  }

  return decodePreferences(value);
}

export async function setUserPreferences(preferences: UserPreferences) {
  const cookieStore = await cookies();

  cookieStore.set(PREFERENCES_COOKIE, encodePreferences(preferences), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function isFavoriteProduct(preferences: UserPreferences, productSlug: string) {
  return preferences.favoriteProductSlugs.includes(productSlug);
}
