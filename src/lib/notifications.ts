import { formatPrice, type Product } from "@/data/catalog";
import { getAppUrl } from "@/lib/app-config";
import { getProductOutboundPath } from "@/lib/outbound-links";
import type {
  KeywordAlert,
  NotificationDelivery,
} from "@/lib/preferences";

export type NotificationMessage = {
  alert: KeywordAlert;
  body: string;
  product: Product;
  subject: string;
};

export function createNotificationMessage(alert: KeywordAlert, product: Product) {
  const subject = `[페어프라이스] ${product.discountRate}% 할인: ${product.title}`;
  const trackedProductUrl = `${getAppUrl()}${getProductOutboundPath(
    product.slug,
    "notification-message",
  )}`;
  const body = [
    `등록한 “${alert.keyword}” 조건에 맞는 특가를 찾았습니다.`,
    "",
    product.title,
    `${formatPrice(product.price)} · ${product.discountRate}% 할인`,
    `${product.brand} · ${product.category.name}`,
    "",
    `상품 보기: ${trackedProductUrl}`,
  ].join("\n");

  return { alert, body, product, subject } satisfies NotificationMessage;
}

export function getPendingNotificationMessages(
  matches: Array<{ alert: KeywordAlert; products: Product[] }>,
  deliveries: NotificationDelivery[],
) {
  const deliveredKeys = new Set(
    deliveries.map((delivery) => `${delivery.alertId}:${delivery.productSlug}`),
  );

  return matches.flatMap(({ alert, products }) =>
    products
      .filter((product) => !deliveredKeys.has(`${alert.id}:${product.slug}`))
      .map((product) => createNotificationMessage(alert, product)),
  );
}

export function createDeliveryRecords(
  messages: NotificationMessage[],
  recipient: string,
  sentAt = new Date(),
) {
  return messages.map<NotificationDelivery>((message) => ({
    alertId: message.alert.id,
    id: crypto.randomUUID(),
    productSlug: message.product.slug,
    recipient,
    sentAt: sentAt.toISOString(),
    subject: message.subject,
  }));
}
