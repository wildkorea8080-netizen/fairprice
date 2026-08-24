"use client";

import { useId, useMemo, useState, type PointerEvent } from "react";

type ChartPoint = { checkedAt: string; price: number };
type Period = 7 | 30 | 90 | 0;

const periods: Array<{ label: string; value: Period }> = [
  { label: "1주", value: 7 },
  { label: "1개월", value: 30 },
  { label: "3개월", value: 90 },
  { label: "전체", value: 0 },
];

const width = 920;
const height = 330;
const padding = { bottom: 44, left: 92, right: 24, top: 24 };

function formatPrice(price: number) {
  return `${new Intl.NumberFormat("ko-KR").format(price)}원`;
}

function formatAxisPrice(price: number) {
  if (price >= 100_000_000) return `${Math.round(price / 10_000_000) / 10}억`;
  if (price >= 10_000) return `${Math.round(price / 1_000) / 10}만`;
  if (price >= 1_000) return `${Math.round(price / 100) / 10}천`;
  return new Intl.NumberFormat("ko-KR").format(price);
}

function formatDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: includeTime ? "2-digit" : undefined,
    minute: includeTime ? "2-digit" : undefined,
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function PriceHistoryChart({ points }: { points: ChartPoint[] }) {
  const gradientId = useId().replaceAll(":", "");
  const [period, setPeriod] = useState<Period>(30);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const data = useMemo(() => {
    const latestTimestamp = Math.max(
      0,
      ...points.map((point) => new Date(point.checkedAt).getTime()),
    );
    const cutoff = period ? latestTimestamp - period * 86_400_000 : 0;
    return [...points]
      .filter((point) => new Date(point.checkedAt).getTime() >= cutoff)
      .sort(
        (left, right) =>
          new Date(left.checkedAt).getTime() - new Date(right.checkedAt).getTime(),
      );
  }, [period, points]);

  const chart = useMemo(() => {
    if (data.length === 0) return null;
    const prices = data.map(({ price }) => price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const rawRange = Math.max(max - min, Math.max(max * 0.02, 1));
    const lower = Math.max(0, min - rawRange * 0.12);
    const upper = max + rawRange * 0.12;
    const range = upper - lower;
    const firstTime = new Date(data[0].checkedAt).getTime();
    const lastTime = new Date(data.at(-1)?.checkedAt ?? data[0].checkedAt).getTime();
    const timeRange = Math.max(lastTime - firstTime, 1);
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const coordinates = data.map((point) => ({
      ...point,
      x:
        padding.left +
        ((new Date(point.checkedAt).getTime() - firstTime) / timeRange) * plotWidth,
      y: padding.top + ((upper - point.price) / range) * plotHeight,
    }));
    const path = coordinates
      .map(({ x, y }, index) => `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");
    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      return {
        price: Math.round(upper - ratio * range),
        y: padding.top + ratio * plotHeight,
      };
    });
    const xTickIndexes = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];

    return { coordinates, max, min, path, xTickIndexes, yTicks };
  }, [data]);

  const activePoint =
    chart && activeIndex !== null ? chart.coordinates[activeIndex] : null;

  function selectNearestPoint(event: PointerEvent<SVGSVGElement>) {
    if (!chart) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    chart.coordinates.forEach((point, index) => {
      const distance = Math.abs(point.x - pointerX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setActiveIndex(nearestIndex);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex border border-slate-200 bg-white p-1" role="group" aria-label="가격 그래프 기간">
          {periods.map((item) => (
            <button
              aria-pressed={period === item.value}
              className={`h-9 px-3 text-sm font-bold transition ${period === item.value ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100"}`}
              key={item.value}
              onClick={() => {
                setPeriod(item.value);
                setActiveIndex(null);
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        {chart ? (
          <p className="text-sm text-slate-500">
            최저 {formatPrice(chart.min)} · 최고 {formatPrice(chart.max)}
          </p>
        ) : null}
      </div>

      {chart && data.length >= 2 ? (
        <div className="relative mt-5 border border-slate-200 bg-white px-2 pb-2 pt-3 sm:px-4">
          <div className="mb-2 flex min-h-12 items-center justify-between gap-3 border-b border-slate-100 px-2 pb-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                {activePoint ? formatDate(activePoint.checkedAt, true) : "그래프 위에 마우스를 올려보세요"}
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {activePoint ? formatPrice(activePoint.price) : "시점별 가격 확인"}
              </p>
            </div>
            {activePoint && activeIndex !== null && activeIndex > 0 ? (() => {
              const previousPrice = chart.coordinates[activeIndex - 1].price;
              const difference = activePoint.price - previousPrice;
              return (
                <span className={`rounded px-2 py-1 text-xs font-bold ${difference < 0 ? "bg-emerald-50 text-emerald-700" : difference > 0 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                  직전 대비 {difference > 0 ? "+" : ""}{formatPrice(difference)}
                </span>
              );
            })() : null}
          </div>

          <div className="overflow-x-auto overscroll-x-contain">
            <svg
              aria-label="기간별 가격 변동 선 그래프. 마우스나 키보드로 각 시점의 가격을 확인할 수 있습니다."
              className="h-auto min-w-[620px] touch-pan-x sm:min-w-0 sm:w-full"
              onPointerLeave={() => setActiveIndex(null)}
              onPointerMove={selectNearestPoint}
              role="img"
              viewBox={`0 0 ${width} ${height}`}
            >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {chart.yTicks.map((tick) => (
              <g key={tick.y}>
                <line stroke="#dbe4ee" strokeDasharray="4 6" x1={padding.left} x2={width - padding.right} y1={tick.y} y2={tick.y} />
                <text fill="#64748b" fontSize="12" textAnchor="end" x={padding.left - 12} y={tick.y + 4}>{formatAxisPrice(tick.price)}</text>
              </g>
            ))}

            {chart.xTickIndexes.map((index) => {
              const point = chart.coordinates[index];
              return <text fill="#64748b" fontSize="12" key={`${point.checkedAt}-${index}`} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} x={point.x} y={height - 13}>{formatDate(point.checkedAt)}</text>;
            })}

            <path d={`${chart.path} L${chart.coordinates.at(-1)?.x},${height - padding.bottom} L${chart.coordinates[0].x},${height - padding.bottom} Z`} fill={`url(#${gradientId})`} />
            <path d={chart.path} fill="none" stroke="#059669" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />

            {activePoint ? (
              <line stroke="#0f172a" strokeDasharray="3 4" strokeOpacity="0.55" x1={activePoint.x} x2={activePoint.x} y1={padding.top} y2={height - padding.bottom} />
            ) : null}

            {chart.coordinates.map((point, index) => {
              const active = activeIndex === index;
              const lowest = point.price === chart.min;
              return (
                <g key={`${point.checkedAt}-${index}`}>
                  <circle
                    aria-label={`${formatDate(point.checkedAt, true)}, ${formatPrice(point.price)}`}
                    className="cursor-crosshair outline-none"
                    cx={point.x}
                    cy={point.y}
                    fill="transparent"
                    onBlur={() => setActiveIndex(null)}
                    onFocus={() => setActiveIndex(index)}
                    r="12"
                    tabIndex={0}
                  />
                  <circle cx={point.x} cy={point.y} fill={lowest ? "#e11d48" : "#059669"} pointerEvents="none" r={active ? 7 : lowest ? 5 : 3} stroke="white" strokeWidth={active ? 3 : 1.5} />
                </g>
              );
            })}
            </svg>
          </div>
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
