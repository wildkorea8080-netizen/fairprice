import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getAppUrl } from "@/lib/app-config";
import { escapeHtml, getEmailConfig, sendTransactionalEmail } from "@/lib/email";
import { hashPassword } from "@/lib/passwords";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const RESET_TOKEN_TTL_MS = 1000 * 60 * 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createResetUrl(token: string) {
  return `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function requestPasswordReset(email: string) {
  if (!isDatabaseConfigured()) {
    return { emailConfigured: false, resetUrl: null };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.role !== "USER") {
    return { emailConfigured: getEmailConfig().isConfigured, resetUrl: null };
  }

  const token = randomBytes(32).toString("base64url");
  const resetUrl = createResetUrl(token);

  await prisma.passwordResetToken.create({
    data: {
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      tokenHash: hashToken(token),
      userId: user.id,
    },
  });

  if (getEmailConfig().isConfigured) {
    await sendTransactionalEmail({
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #0f172a;">
          <p style="margin: 0 0 12px; color: #047857; font-weight: 700;">페어프라이스</p>
          <h1 style="margin: 0 0 16px; font-size: 22px;">비밀번호 재설정</h1>
          <p>아래 버튼을 눌러 비밀번호를 새로 설정해 주세요. 링크는 30분 동안 유효합니다.</p>
          <a href="${escapeHtml(resetUrl)}" style="display: inline-block; margin-top: 12px; background: #059669; color: #ffffff; text-decoration: none; padding: 12px 16px; border-radius: 6px; font-weight: 700;">비밀번호 재설정</a>
          <p style="margin-top: 20px; color: #64748b; font-size: 12px;">요청한 적이 없다면 이 메일을 무시해도 됩니다.</p>
        </div>
      `,
      subject: "[페어프라이스] 비밀번호 재설정",
      text: ["페어프라이스 비밀번호 재설정", "", resetUrl, "", "링크는 30분 동안 유효합니다."].join("\n"),
      to: user.email,
    });
  }

  return {
    emailConfigured: getEmailConfig().isConfigured,
    resetUrl: getEmailConfig().isConfigured ? null : resetUrl,
  };
}

export async function resetPasswordWithToken(token: string, password: string) {
  if (!isDatabaseConfigured()) {
    return false;
  }

  const tokenHash = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    include: { user: true },
    where: { tokenHash },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return false;
  }

  if (resetToken.user.role !== "USER") {
    return false;
  }

  await prisma.$transaction([
    prisma.user.update({
      data: {
        passwordHash: await hashPassword(password),
      },
      where: { id: resetToken.userId },
    }),
    prisma.passwordResetToken.update({
      data: { usedAt: new Date() },
      where: { id: resetToken.id },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    }),
  ]);

  return true;
}
