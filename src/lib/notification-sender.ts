import "server-only";

import {
  escapeHtml,
  getEmailConfig,
  getMaskedEmailStatus,
  sendTransactionalEmail,
} from "@/lib/email";
import { getAppUrl } from "@/lib/app-config";
import { getProductOutboundPath } from "@/lib/outbound-links";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

type SendPendingNotificationsOptions = {
  dryRun?: boolean;
  limit?: number;
};

export type SendPendingNotificationsSummary = {
  dryRun: boolean;
  emailConfigured: boolean;
  failed: number;
  inspected: number;
  sent: number;
  skipped: number;
};

export type TestNotificationEmailSummary = {
  from: string;
  to: string;
};

type PendingNotification = Awaited<
  ReturnType<typeof getPendingNotifications>
>[number];

const WON_FORMATTER = new Intl.NumberFormat("ko-KR");

function clampLimit(value?: number) {
  if (!Number.isFinite(value)) {
    return 20;
  }

  return Math.min(Math.max(Math.floor(value ?? 20), 1), 100);
}

export function getNotificationEmailStatus() {
  return getMaskedEmailStatus();
}

async function getPendingNotifications(limit: number) {
  return prisma.notificationLog.findMany({
    include: {
      alertRule: true,
      product: {
        include: {
          category: true,
        },
      },
      user: true,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    where: { status: "PENDING" },
  });
}

function formatWon(value: number) {
  return `${WON_FORMATTER.format(value)}원`;
}

function getTrackedProductUrl(slug: string) {
  return `${getAppUrl()}${getProductOutboundPath(slug, "notification-email")}`;
}

function describeAlertRule(rule: PendingNotification["alertRule"]) {
  if (!rule) {
    return "관심 조건에 맞는 상품";
  }

  const labels: string[] = [];

  if (rule.keyword) {
    labels.push(`관심 키워드: ${rule.keyword}`);
  }

  if (rule.maxPrice !== null) {
    labels.push(`목표가: ${formatWon(rule.maxPrice)} 이하`);
  }

  if (rule.minDiscountRate !== null) {
    labels.push(`할인율: ${rule.minDiscountRate}% 이상`);
  }

  if (rule.productId && labels.length === 0) {
    labels.push("상품별 가격 알림");
  }

  return labels.length > 0 ? labels.join(" · ") : "관심 조건에 맞는 상품";
}

function buildNotificationBody(log: PendingNotification) {
  const product = log.product;
  const price = formatWon(product.currentPrice);
  const originalPrice = formatWon(product.originalPrice);
  const discount = `${product.discountRate}%`;
  const ruleDescription = describeAlertRule(log.alertRule);
  const trackedProductUrl = getTrackedProductUrl(product.slug);

  const text = [
    "페어프라이스 특가 알림",
    "",
    product.title,
    "",
    `${discount} 할인`,
    `현재가: ${price}`,
    `정상가: ${originalPrice}`,
    `카테고리: ${product.category.name}`,
    `알림 조건: ${ruleDescription}`,
    "",
    `쿠팡 파트너스 링크: ${trackedProductUrl}`,
    "",
    "이 링크는 쿠팡 파트너스 제휴 링크입니다.",
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 12px; color: #047857; font-weight: 700;">페어프라이스 특가 알림</p>
      <h1 style="margin: 0 0 16px; font-size: 22px;">${escapeHtml(product.title)}</h1>
      <p style="margin: 0 0 8px;">알림 조건: ${escapeHtml(ruleDescription)}</p>
      <ul style="padding-left: 18px; margin: 0 0 20px;">
        <li><strong>${escapeHtml(discount)}</strong> 할인</li>
        <li>현재가: <strong>${escapeHtml(price)}</strong></li>
        <li>정상가: ${escapeHtml(originalPrice)}</li>
        <li>카테고리: ${escapeHtml(product.category.name)}</li>
      </ul>
      <a href="${escapeHtml(trackedProductUrl)}" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; padding: 12px 16px; border-radius: 6px; font-weight: 700;">쿠팡에서 보기</a>
      <p style="margin-top: 20px; color: #64748b; font-size: 12px;">이 링크는 쿠팡 파트너스 제휴 링크입니다.</p>
    </div>
  `;

  return { html, text };
}

async function sendResendEmail(log: PendingNotification) {
  const body = buildNotificationBody(log);

  await sendTransactionalEmail({
    html: body.html,
    subject: log.subject,
    text: body.text,
    to: log.user.email,
  });
}

export async function sendTestNotificationEmail(
  to: string,
): Promise<TestNotificationEmailSummary> {
  const config = getEmailConfig();
  const recipient = to.trim();

  if (!config.apiKey || !config.from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("A valid recipient email is required.");
  }

  const subject = "[페어프라이스] 이메일 알림 테스트";
  const text = [
    "페어프라이스 이메일 알림 테스트입니다.",
    "",
    "이 메일이 도착했다면 RESEND_API_KEY와 EMAIL_FROM 설정이 정상입니다.",
    "실제 특가 알림도 같은 발송 경로를 사용합니다.",
  ].join("\n");
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #0f172a;">
      <p style="margin: 0 0 12px; color: #047857; font-weight: 700;">페어프라이스</p>
      <h1 style="margin: 0 0 16px; font-size: 22px;">이메일 알림 테스트</h1>
      <p>이 메일이 도착했다면 <strong>RESEND_API_KEY</strong>와 <strong>EMAIL_FROM</strong> 설정이 정상입니다.</p>
      <p style="margin-top: 20px; color: #64748b; font-size: 12px;">실제 특가 알림도 같은 발송 경로를 사용합니다.</p>
    </div>
  `;

  await sendTransactionalEmail({
    html,
    subject,
    text,
    to: recipient,
  });

  return {
    from: config.from,
    to: recipient,
  };
}

export async function sendPendingNotifications(
  options: SendPendingNotificationsOptions = {},
): Promise<SendPendingNotificationsSummary> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is required for notification sending.");
  }

  const limit = clampLimit(options.limit);
  const emailConfigured = getEmailConfig().isConfigured;
  const dryRun = options.dryRun ?? !emailConfigured;
  const pendingNotifications = await getPendingNotifications(limit);

  const summary: SendPendingNotificationsSummary = {
    dryRun,
    emailConfigured,
    failed: 0,
    inspected: pendingNotifications.length,
    sent: 0,
    skipped: 0,
  };

  for (const log of pendingNotifications) {
    if (dryRun) {
      summary.skipped += 1;
      continue;
    }

    try {
      await sendResendEmail(log);
      await prisma.notificationLog.update({
        data: {
          errorMessage: null,
          sentAt: new Date(),
          status: "SENT",
        },
        where: { id: log.id },
      });
      summary.sent += 1;
    } catch (error) {
      await prisma.notificationLog.update({
        data: {
          errorMessage:
            error instanceof Error ? error.message : "Email sending failed",
          status: "FAILED",
        },
        where: { id: log.id },
      });
      summary.failed += 1;
    }
  }

  return summary;
}
