import "server-only";

import { getAppUrl, getDeploymentMode } from "@/lib/app-config";
import { areCoupangCredentialsConfigured } from "@/lib/coupang/client";
import { getMaskedEmailStatus } from "@/lib/email";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type AdminSettingItem = {
  description: string;
  group: "core" | "automation" | "growth" | "security";
  isReady: boolean;
  label: string;
  value: string;
};

async function canReachDatabase() {
  if (!isDatabaseConfigured()) {
    return false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

function maskValue(value?: string | null) {
  if (!value) {
    return "미설정";
  }

  if (value.length <= 8) {
    return "설정됨";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function isLocalUrl(value: string) {
  return value.includes("localhost") || value.includes("127.0.0.1");
}

export async function getAdminSettingsStatus() {
  const appUrl = getAppUrl();
  const deploymentMode = getDeploymentMode();
  const databaseReachable = await canReachDatabase();
  const emailStatus = getMaskedEmailStatus();
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authSecret = process.env.FAIRPRICE_AUTH_SECRET?.trim();
  const adminPassword = process.env.FAIRPRICE_ADMIN_PASSWORD?.trim();
  const naverVerification = process.env.NAVER_SITE_VERIFICATION?.trim();
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

  const items: AdminSettingItem[] = [
    {
      description: "상품, 가격 이력, 알림, 자동화 로그를 저장하는 PostgreSQL 연결입니다.",
      group: "core",
      isReady: databaseReachable,
      label: "PostgreSQL 데이터베이스",
      value: databaseReachable ? "연결됨" : "연결 필요",
    },
    {
      description: "검색엔진 canonical, sitemap, RSS, 이메일 링크에 사용되는 서비스 주소입니다.",
      group: "core",
      isReady: Boolean(appUrl) && (deploymentMode !== "production" || !isLocalUrl(appUrl)),
      label: "서비스 URL",
      value: appUrl,
    },
    {
      description: "운영 모드에서는 로컬 주소와 데모 비밀번호를 피해야 합니다.",
      group: "core",
      isReady: deploymentMode === "production",
      label: "배포 모드",
      value: deploymentMode === "production" ? "production" : "demo",
    },
    {
      description: "쿠팡 상품 검색, 골드박스 수집, 제휴 링크 변환에 필요합니다.",
      group: "automation",
      isReady: areCoupangCredentialsConfigured(),
      label: "쿠팡 파트너스 API",
      value: areCoupangCredentialsConfigured() ? "설정됨" : "키 필요",
    },
    {
      description: "외부 크론이나 서버 스케줄러가 자동 수집 파이프라인을 호출할 때 사용합니다.",
      group: "automation",
      isReady: Boolean(cronSecret && cronSecret.length >= 16),
      label: "CRON_SECRET",
      value: maskValue(cronSecret),
    },
    {
      description: "특가 알림, 비밀번호 재설정 메일 발송에 필요합니다.",
      group: "automation",
      isReady: emailStatus.isConfigured,
      label: "이메일 발송",
      value: emailStatus.from ?? "RESEND_API_KEY / EMAIL_FROM 필요",
    },
    {
      description: "관리자 로그인 비밀번호입니다. 운영에서는 충분히 긴 별도 값을 사용해야 합니다.",
      group: "security",
      isReady: Boolean(adminPassword && adminPassword.length >= 12),
      label: "관리자 비밀번호",
      value: adminPassword ? "설정됨" : "미설정",
    },
    {
      description: "로그인 세션 서명에 사용됩니다. 운영에서는 예측 불가능한 긴 값이 필요합니다.",
      group: "security",
      isReady: Boolean(authSecret && authSecret.length >= 32),
      label: "세션 서명 키",
      value: maskValue(authSecret),
    },
    {
      description: "네이버 서치어드바이저 소유권 확인 메타태그 값입니다.",
      group: "growth",
      isReady: Boolean(naverVerification),
      label: "네이버 사이트 인증",
      value: naverVerification ? "설정됨" : "미설정",
    },
    {
      description: "구글 서치콘솔 소유권 확인 메타태그 값입니다.",
      group: "growth",
      isReady: Boolean(googleVerification),
      label: "구글 사이트 인증",
      value: googleVerification ? "설정됨" : "미설정",
    },
  ];

  return {
    appUrl,
    deploymentMode,
    items,
    readyCount: items.filter((item) => item.isReady).length,
    totalCount: items.length,
  };
}
