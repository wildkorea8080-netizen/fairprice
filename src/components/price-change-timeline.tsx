type PricePoint = {
  checkedAt: string;
  price: number;
};

type PriceChange = PricePoint & {
  changeAmount: number | null;
  changeRate: number | null;
};

function formatPrice(price: number) {
  return `${new Intl.NumberFormat("ko-KR").format(price)}원`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPriceChanges(points: PricePoint[]) {
  const ordered = [...points].sort(
    (left, right) =>
      new Date(left.checkedAt).getTime() - new Date(right.checkedAt).getTime(),
  );
  const changedPoints = ordered.filter(
    (point, index) => index === 0 || point.price !== ordered[index - 1].price,
  );

  return changedPoints
    .map<PriceChange>((point, index) => {
      const previousPrice = index > 0 ? changedPoints[index - 1].price : null;
      const changeAmount = previousPrice === null ? null : point.price - previousPrice;

      return {
        ...point,
        changeAmount,
        changeRate:
          previousPrice && changeAmount !== null
            ? Math.round((changeAmount / previousPrice) * 1_000) / 10
            : null,
      };
    })
    .reverse()
    .slice(0, 6);
}

export function PriceChangeTimeline({ points }: { points: PricePoint[] }) {
  const changes = getPriceChanges(points);

  if (changes.length === 0) return null;

  return (
    <section className="mt-7 border-t border-slate-200 pt-6" aria-labelledby="price-change-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-black text-emerald-700">PRICE TIMELINE</p>
          <h3 className="mt-1 text-lg font-black" id="price-change-heading">
            주요 가격 변화
          </h3>
        </div>
        <p className="text-xs text-slate-500">동일 가격 반복 관측 제외</p>
      </div>

      <ol className="mt-4 divide-y divide-slate-100 border-y border-slate-200">
        {changes.map((change, index) => {
          const isDrop = (change.changeAmount ?? 0) < 0;
          const isRise = (change.changeAmount ?? 0) > 0;

          return (
            <li
              className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
              key={`${change.checkedAt}-${index}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`size-2.5 shrink-0 rounded-full ${isDrop ? "bg-emerald-600" : isRise ? "bg-rose-500" : "bg-slate-400"}`}
                />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {index === 0 ? "최근 확인" : "가격 변경"}
                  </p>
                  <time className="text-xs text-slate-500" dateTime={change.checkedAt}>
                    {formatDate(change.checkedAt)}
                  </time>
                </div>
              </div>
              <p className="text-lg font-black text-slate-950 sm:text-right">
                {formatPrice(change.price)}
              </p>
              <div className="sm:min-w-28 sm:text-right">
                {change.changeAmount === null ? (
                  <span className="text-xs font-bold text-slate-500">추적 시작</span>
                ) : (
                  <span
                    className={`inline-flex rounded px-2 py-1 text-xs font-bold ${isDrop ? "bg-emerald-50 text-emerald-700" : isRise ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    {isRise ? "+" : ""}
                    {formatPrice(change.changeAmount)} ({isRise ? "+" : ""}
                    {change.changeRate}%)
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
