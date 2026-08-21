"use client";

import { useMemo, useState } from "react";

type ChartPoint = { checkedAt: string; price: number };
type Period = 7 | 30 | 90 | 0;

const periods: Array<{ label: string; value: Period }> = [
  { label: "1주", value: 7 },
  { label: "1개월", value: 30 },
  { label: "3개월", value: 90 },
  { label: "전체", value: 0 },
];

function formatPrice(price: number) {
  return `${new Intl.NumberFormat("ko-KR").format(price)}원`;
}

export function PriceHistoryChart({ points }: { points: ChartPoint[] }) {
  const [period, setPeriod] = useState<Period>(30);
  const data = useMemo(() => {
    const latestTimestamp = Math.max(
      0,
      ...points.map((point) => new Date(point.checkedAt).getTime()),
    );
    const cutoff = period ? latestTimestamp - period * 86_400_000 : 0;
    return [...points]
      .filter((point) => new Date(point.checkedAt).getTime() >= cutoff)
      .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  }, [period, points]);

  const prices = data.map(({ price }) => price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(max - min, 1);
  const width = 760;
  const height = 260;
  const padding = 28;
  const coordinates = data.map((point, index) => ({
    ...point,
    x: padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2),
    y: padding + ((max - point.price) / range) * (height - padding * 2),
  }));
  const path = coordinates.map(({ x, y }, index) => `${index ? "L" : "M"}${x},${y}`).join(" ");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex border border-slate-200 bg-white p-1" role="group" aria-label="가격 그래프 기간">
          {periods.map((item) => (
            <button
              className={`h-9 px-3 text-sm font-bold transition ${period === item.value ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100"}`}
              key={item.value}
              onClick={() => setPeriod(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        {data.length > 0 ? <p className="text-sm text-slate-500">최저 {formatPrice(min)} · 최고 {formatPrice(max)}</p> : null}
      </div>

      {data.length >= 2 ? (
        <div className="mt-5 overflow-hidden border border-slate-200 bg-white p-3">
          <svg className="h-auto w-full" role="img" aria-label="기간별 가격 변동 선 그래프" viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <linearGradient id="price-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((line) => {
              const y = padding + (line / 3) * (height - padding * 2);
              return <line key={line} stroke="#e2e8f0" strokeDasharray="4 5" x1={padding} x2={width - padding} y1={y} y2={y} />;
            })}
            <path d={`${path} L${coordinates.at(-1)?.x},${height - padding} L${padding},${height - padding} Z`} fill="url(#price-area)" />
            <path d={path} fill="none" stroke="#059669" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
            {coordinates.map((point, index) => (
              <circle key={`${point.checkedAt}-${index}`} cx={point.x} cy={point.y} fill={point.price === min ? "#e11d48" : "#059669"} r={point.price === min ? 6 : 3}>
                <title>{new Date(point.checkedAt).toLocaleDateString("ko-KR")} · {formatPrice(point.price)}</title>
              </circle>
            ))}
          </svg>
        </div>
      ) : (
        <div className="mt-5 border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
          <p className="font-bold text-slate-700">가격 데이터를 수집하고 있습니다</p>
          <p className="mt-2 text-sm text-slate-500">두 번 이상 가격이 확인되면 변동 그래프가 표시됩니다.</p>
        </div>
      )}
    </div>
  );
}
