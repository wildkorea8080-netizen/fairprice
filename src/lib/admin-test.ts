import "server-only";

import { getAppUrl } from "@/lib/app-config";
import { getAdminSettingsStatus } from "@/lib/admin-settings";
import { markStaleCronRuns } from "@/lib/cron-pipeline";
import { getLegalConfig, getLegalReadiness } from "@/lib/legal-config";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

export type DiagnosticStatus = "pass" | "warn" | "fail";

export type DiagnosticCheck = {
  description: string;
  detail: string;
  label: string;
  status: DiagnosticStatus;
};

export type DiagnosticGroup = {
  checks: DiagnosticCheck[];
  description: string;
  label: string;
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

function statusFromBoolean(value: boolean): DiagnosticStatus {
  return value ? "pass" : "fail";
}

function statusFromCount(value: number): DiagnosticStatus {
  return value > 0 ? "pass" : "warn";
}

function formatDate(value?: Date | null) {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function isLocalUrl(value: string) {
  return value.includes("localhost") || value.includes("127.0.0.1");
}

function legalStatus(isReady: boolean, isProduction: boolean): DiagnosticStatus {
  if (isReady) {
    return "pass";
  }

  return isProduction ? "fail" : "warn";
}

function isFreshWithin(value: Date | null | undefined, maxAgeMs: number) {
  return Boolean(value && Date.now() - value.getTime() <= maxAgeMs);
}

async function getDatabaseDiagnostics(databaseReachable: boolean) {
  if (!databaseReachable) {
    return {
      activeRules: 0,
      categories: 0,
      clickLogs: 0,
      keywordCandidates: 0,
      latestPriceHistoryAt: null,
      latestProductCheckedAt: null,
      notifications: 0,
      priceHistories: 0,
      products: 0,
      users: 0,
    };
  }

  const [
    products,
    priceHistories,
    categories,
    users,
    activeRules,
    keywordCandidates,
    notifications,
    clickLogs,
    latestPriceHistory,
    latestCheckedProduct,
  ] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.productPriceHistory.count(),
    prisma.category.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.collectionRule.count({ where: { isActive: true } }),
    prisma.keywordCandidate.count(),
    prisma.notificationLog.count(),
    prisma.clickLog.count(),
    prisma.productPriceHistory.findFirst({
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    }),
    prisma.product.findFirst({
      orderBy: { lastCheckedAt: "desc" },
      select: { lastCheckedAt: true },
      where: {
        isActive: true,
        lastCheckedAt: { not: null },
      },
    }),
  ]);

  return {
    activeRules,
    categories,
    clickLogs,
    keywordCandidates,
    latestPriceHistoryAt: latestPriceHistory?.checkedAt ?? null,
    latestProductCheckedAt: latestCheckedProduct?.lastCheckedAt ?? null,
    notifications,
    priceHistories,
    products,
    users,
  };
}

async function getAutomationDiagnostics(databaseReachable: boolean) {
  if (!databaseReachable) {
    return {
      latestRun: null,
      pendingJobs: 0,
      runningJobs: 0,
      staleRunsMarked: 0,
    };
  }

  const staleRunsMarked = await markStaleCronRuns();
  const [latestRun, pendingJobs, runningJobs] = await Promise.all([
    prisma.cronRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.collectionJob.count({ where: { status: "PENDING" } }),
    prisma.collectionJob.count({ where: { status: "RUNNING" } }),
  ]);

  return {
    latestRun,
    pendingJobs,
    runningJobs,
    staleRunsMarked,
  };
}

export async function getAdminTestReport() {
  const [settings, databaseReachable] = await Promise.all([
    getAdminSettingsStatus(),
    canReachDatabase(),
  ]);
  const [database, automation] = await Promise.all([
    getDatabaseDiagnostics(databaseReachable),
    getAutomationDiagnostics(databaseReachable),
  ]);
  const appUrl = getAppUrl();
  const settingByLabel = new Map(
    settings.items.map((item) => [item.label, item]),
  );
  const latestRun = automation.latestRun;
  const legalConfig = getLegalConfig();
  const legalReadiness = getLegalReadiness();
  const legalConfigured = legalReadiness.ready;
  const isProduction = settings.deploymentMode === "production";
  const latestRunIsFresh = latestRun
    ? Date.now() - latestRun.startedAt.getTime() <= 60 * 60 * 1000
    : false;
  const appUrlReady =
    !isProduction || !isLocalUrl(appUrl);
  const coupangReady =
    settingByLabel.get("쿠팡 파트너스 API")?.isReady ?? false;
  const cronReady = settingByLabel.get("CRON_SECRET")?.isReady ?? false;
  const emailReady = settingByLabel.get("이메일 발송")?.isReady ?? false;
  const priceFreshnessMs = 24 * 60 * 60 * 1000;
  const latestProductCheckIsFresh = isFreshWithin(
    database.latestProductCheckedAt,
    priceFreshnessMs,
  );
  const latestPriceHistoryIsFresh = isFreshWithin(
    database.latestPriceHistoryAt,
    priceFreshnessMs,
  );
  const productionServicesReady = Boolean(
    databaseReachable &&
      appUrlReady &&
      coupangReady &&
      cronReady &&
      emailReady &&
      legalConfigured,
  );

  const groups: DiagnosticGroup[] = [
    {
      description: "서비스 실행, 데이터베이스, 공개 URL의 기본 준비 상태입니다.",
      label: "핵심 인프라",
      checks: [
        {
          description: "PostgreSQL 연결과 Prisma 쿼리 실행 여부입니다.",
          detail: databaseReachable ? "SELECT 1 성공" : "DATABASE_URL 또는 DB 연결 확인 필요",
          label: "데이터베이스 연결",
          status: statusFromBoolean(databaseReachable),
        },
        {
          description: "검색엔진, 이메일, RSS, sitemap에 사용되는 공개 주소입니다.",
          detail: appUrl,
          label: "서비스 URL",
          status:
            isProduction && isLocalUrl(appUrl)
              ? "fail"
              : "pass",
        },
        {
          description: "운영 배포 전에는 production 모드 전환 여부를 확인해야 합니다.",
          detail: settings.deploymentMode,
          label: "배포 모드",
          status: isProduction ? "pass" : "warn",
        },
        {
          description:
            "DB, 공개 URL, 쿠팡 API, cron 비밀값, 이메일 발송, 운영자 정보가 함께 준비됐는지 확인합니다.",
          detail: productionServicesReady
            ? "운영 필수 서비스 준비 완료"
            : "DB, URL, 쿠팡 API, CRON_SECRET, 이메일, 운영자 정보 확인 필요",
          label: "운영 서비스 준비",
          status: productionServicesReady ? "pass" : "warn",
        },
      ],
    },
    {
      description: "상품 수집과 가격 추적 데이터가 쌓이고 있는지 확인합니다.",
      label: "상품 데이터",
      checks: [
        {
          description: "공개 목록과 상세 페이지에 노출되는 활성 상품 수입니다.",
          detail: `${database.products}개`,
          label: "활성 상품",
          status: statusFromCount(database.products),
        },
        {
          description: "가격 하락 계산에 필요한 가격 이력 수입니다.",
          detail: `${database.priceHistories}개`,
          label: "가격 이력",
          status: statusFromCount(database.priceHistories),
        },
        {
          description: "활성 상품이 마지막으로 가격 확인된 시각입니다.",
          detail: formatDate(database.latestProductCheckedAt),
          label: "최근 상품 확인",
          status: latestProductCheckIsFresh ? "pass" : "warn",
        },
        {
          description: "가격 이력이 마지막으로 추가된 시각입니다.",
          detail: formatDate(database.latestPriceHistoryAt),
          label: "최근 가격 이력",
          status: latestPriceHistoryIsFresh ? "pass" : "warn",
        },
        {
          description: "상품 탐색과 SEO URL에 쓰이는 활성 카테고리 수입니다.",
          detail: `${database.categories}개`,
          label: "활성 카테고리",
          status: statusFromCount(database.categories),
        },
        {
          description: "자동 수집을 실행할 승인된 키워드/규칙 수입니다.",
          detail: `${database.activeRules}개`,
          label: "수집 규칙",
          status: statusFromCount(database.activeRules),
        },
      ],
    },
    {
      description: "쿠팡 API, cron, 이메일처럼 외부 연동이 필요한 항목입니다.",
      label: "외부 연동",
      checks: [
        {
          description: "쿠팡 상품 검색, 베스트, 골드박스 수집에 필요한 키입니다.",
          detail: settingByLabel.get("쿠팡 파트너스 API")?.value ?? "확인 필요",
          label: "쿠팡 파트너스 API",
          status: settingByLabel.get("쿠팡 파트너스 API")?.isReady
            ? "pass"
            : "fail",
        },
        {
          description: "크론 엔드포인트 호출 보호에 필요한 비밀값입니다.",
          detail: settingByLabel.get("CRON_SECRET")?.value ?? "확인 필요",
          label: "CRON_SECRET",
          status: settingByLabel.get("CRON_SECRET")?.isReady ? "pass" : "fail",
        },
        {
          description: "비밀번호 재설정과 특가 이메일 발송 설정입니다.",
          detail: settingByLabel.get("이메일 발송")?.value ?? "확인 필요",
          label: "이메일 발송",
          status: settingByLabel.get("이메일 발송")?.isReady ? "pass" : "warn",
        },
      ],
    },
    {
      description: "약관, 개인정보처리방침, 사용자 문의에 표시되는 운영자 정보입니다.",
      label: "법적 고지",
      checks: [
        {
          description: "약관과 개인정보처리방침에 표시되는 운영자명입니다.",
          detail: legalConfig.operatorName,
          label: "운영자명",
          status: legalStatus(legalReadiness.operatorNameReady, isProduction),
        },
        {
          description: "사용자 문의와 개인정보 요청을 받을 공개 이메일입니다.",
          detail: legalConfig.contactEmail,
          label: "문의 이메일",
          status: legalStatus(legalReadiness.contactEmailReady, isProduction),
        },
      ],
    },
    {
      description: "자동 수집 파이프라인과 알림 대기열 상태입니다.",
      label: "자동화",
      checks: [
        {
          description: "최근 cron 파이프라인 실행 상태입니다.",
          detail: latestRun
            ? `${latestRun.status} · ${formatDate(latestRun.startedAt)}`
            : "실행 기록 없음",
          label: "최근 파이프라인",
          status: latestRun?.status === "SUCCESS" && latestRunIsFresh ? "pass" : "warn",
        },
        {
          description: "실행 대기 중인 상품 수집 작업입니다.",
          detail: `${automation.pendingJobs}개`,
          label: "대기 작업",
          status: automation.pendingJobs > 0 ? "warn" : "pass",
        },
        {
          description: "진행 중인 작업과 타임아웃 처리 결과입니다.",
          detail: `실행 중 ${automation.runningJobs}개 · 정리 ${automation.staleRunsMarked}개`,
          label: "작업 상태",
          status: automation.runningJobs > 0 ? "warn" : "pass",
        },
        {
          description: "생성된 알림 로그 수입니다. 발송 전후 상태는 알림 대기열에서 확인합니다.",
          detail: `${database.notifications}개`,
          label: "알림 로그",
          status: database.notifications > 0 ? "pass" : "warn",
        },
      ],
    },
    {
      description: "검색 노출과 전환 분석에 필요한 공개 엔드포인트와 데이터입니다.",
      label: "SEO/분석",
      checks: [
        {
          description: "검색엔진에 제출할 sitemap URL입니다.",
          detail: `${appUrl}/sitemap.xml`,
          label: "Sitemap",
          status: "pass",
        },
        {
          description: "크롤러 정책 파일입니다. /out/ 추적 URL은 색인 제외됩니다.",
          detail: `${appUrl}/robots.txt`,
          label: "Robots",
          status: "pass",
        },
        {
          description: "최신 특가 상품 RSS 피드입니다.",
          detail: `${appUrl}/feed.xml`,
          label: "RSS 피드",
          status: "pass",
        },
        {
          description: "제휴 전환 분석에 필요한 클릭 로그 수입니다.",
          detail: `${database.clickLogs}개`,
          label: "클릭 로그",
          status: database.clickLogs > 0 ? "pass" : "warn",
        },
      ],
    },
  ];

  const checks = groups.flatMap((group) => group.checks);

  return {
    checkedAt: new Date(),
    groups,
    passCount: checks.filter((check) => check.status === "pass").length,
    warnCount: checks.filter((check) => check.status === "warn").length,
    failCount: checks.filter((check) => check.status === "fail").length,
    totalCount: checks.length,
  };
}
