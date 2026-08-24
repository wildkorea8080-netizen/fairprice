import Link from "next/link";
import { getAdminDealEngineOverview } from "@/lib/admin-deal-engine";
import { formatKoreanPrice } from "@/lib/deal-products";

const eventLabels: Record<string, string> = {
  AVERAGE_PRICE_DROP: "평균가 대비 하락",
  HIGH_DEAL_SCORE: "고득점 특가",
  LOWEST_30D: "30일 최저가",
  LOWEST_90D: "90일 최저가",
  NEAR_ALL_TIME_LOW: "역대 최저가 근접",
  RAPID_DROP: "단기 급락",
};

const confidenceLabels = {
  COLLECTING: "수집 중",
  PRELIMINARY: "예비 검증",
  RELIABLE: "신뢰도 확보",
} as const;

function formatDate(date: Date | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function productFor(item: {
  offer: {
    dealEntity: {
      shoppingVariant: { product: { slug: string; title: string } | null } | null;
      title: string;
    };
  };
}) {
  const product = item.offer.dealEntity.shoppingVariant?.product;
  return { slug: product?.slug, title: product?.title ?? item.offer.dealEntity.title };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

export default async function AdminDealEnginePage() {
  const overview = await getAdminDealEngineOverview();

  if (!overview) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-800">
        Deal Engine 관제를 사용하려면 PostgreSQL 연결이 필요합니다.
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold text-emerald-700">Deal Engine Operations</p>
        <h2 className="mt-1 text-2xl font-bold">가격 신호 및 Hot Deal 관제</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          점수 산출 근거와 탐지 이벤트를 확인합니다. 수집 중 신호는 메인에서
          검증 중으로 표시되고, 신뢰도가 확보된 90점 이상 상품만 확정 Hot Deal로
          승격됩니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="분석 상품" value={`${overview.analyses.length}개`} />
        <Stat label="수집 중" value={`${overview.confidence.collecting}개`} />
        <Stat label="예비 검증" value={`${overview.confidence.preliminary}개`} />
        <Stat label="신뢰도 확보" value={`${overview.confidence.reliable}개`} />
        <Stat label="활성 Hot Deal" value={`${overview.activeDeals}개`} />
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-bold">최근 상품 분석</h3>
          <p className="mt-1 text-sm text-slate-500">상품별 최신 점수와 승격 조건 충족 정도입니다.</p>
        </div>
        <div className="divide-y divide-slate-200">
          {overview.analyses.slice(0, 30).map((analysis) => {
            const product = productFor(analysis);
            return (
              <div className="grid gap-3 px-5 py-4 lg:grid-cols-[1.5fr_0.45fr_0.6fr_0.65fr_0.8fr] lg:items-center" key={analysis.id}>
                <div>
                  {product.slug ? (
                    <Link className="font-bold hover:text-emerald-700" href={`/products/${product.slug}`}>{product.title}</Link>
                  ) : <p className="font-bold">{product.title}</p>}
                  <p className="mt-1 text-xs text-slate-500">{analysis.scoreConfig.key} v{analysis.scoreConfig.version} · {formatDate(analysis.calculatedAt)}</p>
                </div>
                <p className="text-2xl font-black">{analysis.score}점</p>
                <span className="w-fit rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{confidenceLabels[analysis.confidence]}</span>
                <p className="text-sm"><strong>{analysis.sampleCount}회</strong><br /><span className="text-slate-500">{analysis.trackingDays}일 추적</span></p>
                <p className="text-sm"><strong>{formatKoreanPrice(analysis.currentPrice)}</strong><br /><span className="text-slate-500">평균 {formatKoreanPrice(analysis.averagePrice)}</span></p>
              </div>
            );
          })}
          {overview.analyses.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">아직 가격 분석 기록이 없습니다.</p> : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-lg font-bold">최근 가격 신호</h3>
            <p className="mt-1 text-sm text-slate-500">누적 {overview.totalEvents}건</p>
          </div>
          <div className="divide-y divide-slate-200">
            {overview.events.slice(0, 15).map((event) => {
              const product = productFor(event);
              return (
                <div className="px-5 py-4" key={event.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{product.title}</p>
                    <span className="rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">{eventLabels[event.eventType] ?? event.eventType}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">감지가 {formatKoreanPrice(event.triggerPrice)} · 기준가 {event.referencePrice ? formatKoreanPrice(event.referencePrice) : "-"} · 점수 {event.score ?? 0}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDate(event.detectedAt)}</p>
                </div>
              );
            })}
            {overview.events.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">아직 탐지된 가격 신호가 없습니다.</p> : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-lg font-bold">Hot Deal 이력</h3>
            <p className="mt-1 text-sm text-slate-500">확정, 후보, 만료 상태를 함께 확인합니다.</p>
          </div>
          <div className="divide-y divide-slate-200">
            {overview.deals.slice(0, 15).map((deal) => {
              const product = productFor(deal);
              const active = deal.status === "ACTIVE" && (!deal.expiresAt || deal.expiresAt > new Date());
              return (
                <div className="px-5 py-4" key={deal.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{product.title}</p>
                    <span className={`rounded px-2 py-1 text-xs font-bold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{active ? "ACTIVE" : deal.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">Deal Score {deal.score} · Rank {deal.rankScore.toFixed(1)} · {eventLabels[deal.primaryEvent?.eventType ?? ""] ?? "가격 신호"}</p>
                  <p className="mt-1 text-xs text-slate-400">시작 {formatDate(deal.startsAt)} · 만료 {formatDate(deal.expiresAt)}</p>
                </div>
              );
            })}
            {overview.deals.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">아직 생성된 Hot Deal이 없습니다.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

