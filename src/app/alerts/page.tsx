import Link from "next/link";
import type { Metadata } from "next";
import {
  addKeywordAlert,
  removeFavoriteProduct,
  removeKeywordAlert,
  removeProductPriceAlert,
  sendMatchedAlertTest,
} from "@/app/alerts/actions";
import { AlertStatusMessage } from "@/components/alerts/status-message";
import { formatPrice, getProductBySlug, products } from "@/data/catalog";
import {
  getUniqueMatchedProducts,
  matchProductsToAlerts,
} from "@/lib/alert-matcher";
import { requireUser } from "@/lib/auth";
import {
  createNotificationMessage,
  getPendingNotificationMessages,
} from "@/lib/notifications";
import { getUserPreferences } from "@/lib/preferences";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { ensureDatabaseUser } from "@/lib/users";

type AlertsPageProps = {
  searchParams: Promise<{
    count?: string;
    status?: string;
  }>;
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "알림 설정",
};

async function getProductAlertRules(user: Awaited<ReturnType<typeof requireUser>>) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const databaseUser = await ensureDatabaseUser(user);

  if (!databaseUser) {
    return [];
  }

  return prisma.alertRule.findMany({
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    where: {
      isActive: true,
      productId: {
        not: null,
      },
      userId: databaseUser.id,
    },
  });
}

function describeRule(rule: {
  maxPrice?: number | null;
  minDiscountRate?: number | null;
}) {
  const parts = [
    rule.maxPrice ? `${formatPrice(rule.maxPrice)} 이하` : null,
    rule.minDiscountRate ? `${rule.minDiscountRate}% 이상 할인` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" 또는 ") : "조건 없음";
}

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  const { count, status } = await searchParams;
  const user = await requireUser("/alerts");
  const preferences = await getUserPreferences();
  const productAlertRules = await getProductAlertRules(user);

  const favoriteProducts = preferences.favoriteProductSlugs
    .map((slug) => getProductBySlug(slug))
    .filter((product) => product !== undefined);
  const alertMatches = matchProductsToAlerts(products, preferences.keywordAlerts);
  const matchedProducts = getUniqueMatchedProducts(alertMatches);
  const matchedRuleCount = alertMatches.filter((match) => match.products.length > 0).length;
  const pendingMessages = getPendingNotificationMessages(
    alertMatches,
    preferences.notificationDeliveries,
  );
  const previewMessage = alertMatches
    .flatMap(({ alert, products: matchingProducts }) =>
      matchingProducts.map((product) => createNotificationMessage(alert, product)),
    )
    .at(0);

  return (
    <main className="flex-1 bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Alerts
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">알림 설정</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            {user.name}님의 관심 상품, 키워드 조건, 상품별 가격 추적 조건을 한 곳에서
            관리합니다.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_0.85fr] lg:px-8">
        <div className="space-y-6">
          <AlertStatusMessage status={status} />
          {status === "notification-sent" && count ? (
            <p className="-mt-3 text-sm font-semibold text-emerald-700">
              이번 실행에서 {count}건을 생성했습니다.
            </p>
          ) : null}

          <section className="overflow-hidden rounded-lg border border-emerald-200 bg-white shadow-sm">
            <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-emerald-700">조건 매칭 결과</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    지금 구매 조건을 충족한 상품
                  </h2>
                </div>
                <div className="flex gap-2 text-sm font-bold">
                  <span className="rounded-md bg-white px-3 py-2 text-emerald-800 shadow-sm">
                    상품 {matchedProducts.length}개
                  </span>
                  <span className="rounded-md bg-white px-3 py-2 text-slate-700 shadow-sm">
                    규칙 {matchedRuleCount}개
                  </span>
                </div>
              </div>
            </div>

            {alertMatches.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {alertMatches.map(({ alert, products: matchingProducts }) => (
                  <div className="p-6" key={alert.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-950">
                          {alert.keyword} 매칭
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {describeRule(alert)}
                        </p>
                      </div>
                      <span
                        className={`rounded-md px-3 py-1.5 text-sm font-bold ${
                          matchingProducts.length > 0
                            ? "bg-rose-50 text-rose-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {matchingProducts.length}개 발견
                      </span>
                    </div>

                    {matchingProducts.length > 0 ? (
                      <div className="mt-4 grid gap-3">
                        {matchingProducts.map((product) => (
                          <Link
                            className="grid gap-2 rounded-md border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40 sm:grid-cols-[1fr_auto] sm:items-center"
                            href={`/products/${product.slug}`}
                            key={product.slug}
                          >
                            <div>
                              <p className="font-bold text-slate-950">{product.title}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {product.brand} · {product.category.name}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 sm:justify-end">
                              <span className="font-bold text-slate-950">
                                {formatPrice(product.price)}
                              </span>
                              <span className="rounded-md bg-rose-50 px-2 py-1 text-sm font-bold text-rose-700">
                                {product.discountRate}%
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        현재 등록된 상품 중 조건을 충족한 상품이 없습니다.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <p className="font-bold text-slate-700">아직 키워드 알림 조건이 없습니다.</p>
                <p className="mt-1 text-sm text-slate-500">
                  오른쪽에서 키워드와 구매 조건을 추가하면 결과가 여기에 표시됩니다.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">상품별 가격 알림</h2>
                <p className="mt-1 text-sm text-slate-500">
                  상품 상세에서 등록한 목표가와 할인율 조건입니다.
                </p>
              </div>
              <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                {productAlertRules.length}개
              </span>
            </div>

            <div className="mt-5 divide-y divide-slate-200">
              {productAlertRules.length > 0 ? (
                productAlertRules.map((rule) =>
                  rule.product ? (
                    <div key={rule.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]">
                      <div>
                        <Link
                          className="font-bold text-slate-950 hover:text-emerald-700"
                          href={`/products/${rule.product.slug}`}
                        >
                          {rule.product.title}
                        </Link>
                        <p className="mt-1 text-sm text-slate-500">
                          {rule.product.category.name} · 현재가{" "}
                          {formatPrice(rule.product.currentPrice)} · 할인율{" "}
                          {rule.product.discountRate}%
                        </p>
                        <p className="mt-1 text-sm font-semibold text-emerald-700">
                          조건: {describeRule(rule)}
                        </p>
                      </div>
                      <form action={removeProductPriceAlert}>
                        <input name="id" type="hidden" value={rule.id} />
                        <button
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                          type="submit"
                        >
                          삭제
                        </button>
                      </form>
                    </div>
                  ) : null,
                )
              ) : (
                <div className="py-8 text-sm text-slate-500">
                  아직 상품별 가격 알림이 없습니다. 상품 상세 페이지에서 목표가 또는 최소
                  할인율을 등록해 보세요.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">관심 상품</h2>
                <p className="mt-1 text-sm text-slate-500">
                  상품 상세 카드에서 등록한 관심 상품입니다.
                </p>
              </div>
              <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                {favoriteProducts.length}개
              </span>
            </div>

            <div className="mt-5 divide-y divide-slate-200">
              {favoriteProducts.length > 0 ? (
                favoriteProducts.map((product) => (
                  <div key={product.slug} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]">
                    <div>
                      <Link
                        className="font-bold text-slate-950 hover:text-emerald-700"
                        href={`/products/${product.slug}`}
                      >
                        {product.title}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">
                        {product.category.name} · {formatPrice(product.price)} ·{" "}
                        {product.discountRate}% 할인
                      </p>
                    </div>
                    <form action={removeFavoriteProduct}>
                      <input name="slug" type="hidden" value={product.slug} />
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                        type="submit"
                      >
                        삭제
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <div className="py-8 text-sm text-slate-500">
                  아직 관심 상품이 없습니다. 특가 목록에서 상품을 등록해 보세요.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">키워드 알림 조건</h2>
            <p className="mt-1 text-sm text-slate-500">
              키워드, 최소 할인율, 최대 가격을 조합해 알림 조건을 만듭니다.
            </p>

            <div className="mt-5 divide-y divide-slate-200">
              {preferences.keywordAlerts.length > 0 ? (
                preferences.keywordAlerts.map((alert) => (
                  <div key={alert.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]">
                    <div>
                      <p className="font-bold text-slate-950">{alert.keyword}</p>
                      <p className="mt-1 text-sm text-slate-500">{describeRule(alert)}</p>
                    </div>
                    <form action={removeKeywordAlert}>
                      <input name="id" type="hidden" value={alert.id} />
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                        type="submit"
                      >
                        삭제
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <div className="py-8 text-sm text-slate-500">
                  등록된 키워드 알림이 없습니다.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-emerald-700">Email outbox</p>
                <h2 className="mt-1 text-xl font-bold">이메일 알림 발송함</h2>
                <p className="mt-1 text-sm text-slate-500">
                  현재는 외부 메일 서비스 대신 로컬 발송 기록으로 동작합니다.
                </p>
              </div>
              <form action={sendMatchedAlertTest}>
                <button
                  className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={pendingMessages.length === 0}
                  type="submit"
                >
                  새 알림 {pendingMessages.length}건 테스트 발송
                </button>
              </form>
            </div>

            {previewMessage ? (
              <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">메일 미리보기</p>
                <p className="mt-2 font-bold text-slate-950">{previewMessage.subject}</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {previewMessage.body}
                </p>
              </div>
            ) : null}

            <div className="mt-5 divide-y divide-slate-200 border-t border-slate-200">
              {preferences.notificationDeliveries.length > 0 ? (
                preferences.notificationDeliveries.map((delivery) => {
                  const product = getProductBySlug(delivery.productSlug);

                  return (
                    <div className="grid gap-2 py-4 sm:grid-cols-[1fr_auto]" key={delivery.id}>
                      <div>
                        <p className="font-bold text-slate-950">{delivery.subject}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {delivery.recipient}
                          {product ? ` · ${product.title}` : ""}
                        </p>
                      </div>
                      <time className="text-sm text-slate-500" dateTime={delivery.sentAt}>
                        {new Intl.DateTimeFormat("ko-KR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Seoul",
                        }).format(new Date(delivery.sentAt))}
                      </time>
                    </div>
                  );
                })
              ) : (
                <p className="py-6 text-sm text-slate-500">
                  아직 생성된 이메일 알림 기록이 없습니다.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">키워드 추가</h2>
          <form action={addKeywordAlert} className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">관심 키워드</span>
              <input
                className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                name="keyword"
                placeholder="예: 로봇청소기"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">최소 할인율</span>
              <input
                className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                max="100"
                min="1"
                name="minDiscountRate"
                placeholder="30"
                type="number"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">최대 가격</span>
              <input
                className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                min="1"
                name="maxPrice"
                placeholder="50000"
                type="number"
              />
            </label>
            <button
              className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              type="submit"
            >
              알림 조건 추가
            </button>
          </form>
        </aside>
      </section>
    </main>
  );
}
