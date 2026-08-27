"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";

type ChartPoint = { checkedAt: string; price: number };
type Period = 7 | 30 | 90 | 0;

const periods: Array<{ label: string; value: Period }> = [
  { label: "1주", value: 7 },
  { label: "1개월", value: 30 },
  { label: "3개월", value: 90 },
  { label: "전체", value: 0 },
];

const DAY_MS = 86_400_000;

function formatPrice(price: number) {
  return `${new Intl.NumberFormat("ko-KR").format(price)}원`;
}

function formatAxisPrice(price: number) {
  if (price >= 100_000_000) return `${Math.round(price / 10_000_000) / 10}억`;
  if (price >= 10_000) return `${Math.round(price / 1_000) / 10}만`;
  return new Intl.NumberFormat("ko-KR").format(price);
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/**
 * Narrow screens get the short form. A full "8. 24. 오전 08:50" is about ninety
 * pixels wide, so three of them collide on a 300px axis.
 */
function formatAxisDate(timestamp: number, withTime: boolean, compact: boolean) {
  const date = new Date(timestamp);

  if (compact) {
    return new Intl.DateTimeFormat("ko-KR", {
      ...(withTime
        ? { hour: "2-digit", hour12: false, minute: "2-digit" }
        : { day: "numeric", month: "numeric" }),
    }).format(date);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: withTime ? "2-digit" : undefined,
    minute: withTime ? "2-digit" : undefined,
    month: "numeric",
  }).format(date);
}

/**
 * Renders at the container's real pixel width. A fixed viewBox scaled down with
 * CSS shrinks the axis labels along with it, which is why the previous version
 * needed a 620px minimum and a horizontal scrollbar on phones.
 *
 * The width is measured directly rather than waiting for the observer's first
 * callback. ResizeObserver delivers callbacks during the rendering lifecycle,
 * so a tab that is never composited - hidden, backgrounded, screenshotted
 * headlessly - never gets one, and the chart would sit at width zero forever.
 */
function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    setWidth(element.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function PriceHistoryChart({ points }: { points: ChartPoint[] }) {
  const gradientId = useId().replaceAll(":", "");
  const [period, setPeriod] = useState<Period>(30);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { ref, width } = useElementWidth();

  const compact = width > 0 && width < 560;
  const height = compact ? 240 : 320;
  const paddingBottom = 32;
  const paddingLeft = compact ? 56 : 78;
  const paddingRight = compact ? 12 : 20;
  const paddingTop = 20;

  // Always computed from the full series. The old code took its 최저/최고 from
  // whatever period was selected, so switching to 1주 relabelled that week's
  // cheapest observation as the lowest price ever seen.
  const allTime = useMemo(() => {
    const prices = points.map((point) => point.price);

    if (prices.length === 0) {
      return null;
    }

    return {
      average: Math.round(
        prices.reduce((sum, price) => sum + price, 0) / prices.length,
      ),
      high: Math.max(...prices),
      low: Math.min(...prices),
    };
  }, [points]);

  // The caller passes history newest first, so nothing here may assume the
  // array is chronological. Reading points.at(-1) as "current price" showed the
  // oldest observation instead.
  const sortedPoints = useMemo(
    () =>
      [...points].sort(
        (left, right) =>
          new Date(left.checkedAt).getTime() -
          new Date(right.checkedAt).getTime(),
      ),
    [points],
  );

  const data = useMemo(() => {
    if (!period) {
      return sortedPoints;
    }

    const latest = new Date(sortedPoints.at(-1)?.checkedAt ?? 0).getTime();

    return sortedPoints.filter(
      (point) => new Date(point.checkedAt).getTime() >= latest - period * DAY_MS,
    );
  }, [period, sortedPoints]);

  const chart = useMemo(() => {
    if (data.length === 0 || width === 0 || !allTime) {
      return null;
    }

    const prices = data.map((point) => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Keep the all-time low inside the plot so its reference line stays visible
    // even when the selected period never came close to it.
    const lowBound = Math.min(min, allTime.low);
    const highBound = Math.max(max, allTime.average);
    const span = Math.max(highBound - lowBound, Math.max(highBound * 0.02, 1));
    const upper = highBound + span * 0.14;
    const lower = Math.max(0, lowBound - span * 0.14);
    const range = upper - lower;

    const firstTime = new Date(data[0].checkedAt).getTime();
    const lastTime = new Date(
      data.at(-1)?.checkedAt ?? data[0].checkedAt,
    ).getTime();
    const timeRange = Math.max(lastTime - firstTime, 1);
    const plotWidth = Math.max(width - paddingLeft - paddingRight, 1);
    const plotHeight = height - paddingTop - paddingBottom;

    const toX = (time: number) =>
      paddingLeft + ((time - firstTime) / timeRange) * plotWidth;
    const toY = (price: number) =>
      paddingTop + ((upper - price) / range) * plotHeight;

    const coordinates = data.map((point) => ({
      ...point,
      x: toX(new Date(point.checkedAt).getTime()),
      y: toY(point.price),
    }));

    // A price holds until the next observation, so the line steps rather than
    // sloping. Interpolating draws prices that were never observed.
    const path = coordinates
      .map((point, index) =>
        index === 0
          ? `M${point.x.toFixed(1)},${point.y.toFixed(1)}`
          : `H${point.x.toFixed(1)}V${point.y.toFixed(1)}`,
      )
      .join(" ");

    const yTickCount = compact ? 3 : 4;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, index) => {
      const ratio = index / yTickCount;

      return {
        price: Math.round(upper - ratio * range),
        y: paddingTop + ratio * plotHeight,
      };
    });

    const withTime = timeRange < 2 * DAY_MS;
    // Only the endpoints on a narrow axis; anything between them overlaps.
    const xTickCount = compact ? 1 : 4;
    const xTicks = Array.from({ length: xTickCount + 1 }, (_, index) => {
      const ratio = index / xTickCount;

      return {
        label: formatAxisDate(firstTime + timeRange * ratio, withTime, compact),
        textAnchor:
          index === 0
            ? ("start" as const)
            : index === xTickCount
              ? ("end" as const)
              : ("middle" as const),
        x: paddingLeft + plotWidth * ratio,
      };
    });

    const referenceLines = [
      {
        color: "#e11d48",
        label: "역대 최저",
        price: allTime.low,
        y: toY(allTime.low),
      },
      {
        color: "#94a3b8",
        label: "평균",
        price: allTime.average,
        y: toY(allTime.average),
      },
    ].filter((line) => line.y >= paddingTop && line.y <= height - paddingBottom);

    return {
      coordinates,
      lower,
      lowestIndex: prices.indexOf(min),
      max,
      min,
      path,
      referenceLines,
      xTicks,
      yTicks,
    };
  }, [
    allTime,
    compact,
    data,
    height,
    paddingBottom,
    paddingLeft,
    paddingRight,
    paddingTop,
    width,
  ]);

  const activePoint =
    chart && activeIndex !== null ? chart.coordinates[activeIndex] : null;
  const latestPrice = sortedPoints.at(-1)?.price ?? 0;
  const gapToLow = allTime ? latestPrice - allTime.low : 0;

  function selectNearestPoint(event: PointerEvent<SVGSVGElement>) {
    if (!chart) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
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
      {allTime ? (
        <div className="grid grid-cols-3 border-l border-t border-slate-200">
          <div className="border-b border-r border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-500">현재가</p>
            <p className="mt-1 text-base font-black text-slate-950 sm:text-lg">
              {formatPrice(latestPrice)}
            </p>
          </div>
          <div className="border-b border-r border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-500">역대 최저가</p>
            <p className="mt-1 text-base font-black text-rose-600 sm:text-lg">
              {formatPrice(allTime.low)}
            </p>
          </div>
          <div className="border-b border-r border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-500">최저가 대비</p>
            <p
              className={`mt-1 text-base font-black sm:text-lg ${
                gapToLow > 0 ? "text-slate-950" : "text-emerald-600"
              }`}
            >
              {gapToLow > 0 ? `+${formatPrice(gapToLow)}` : "최저가"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div
          aria-label="가격 그래프 기간"
          className="flex border border-slate-200 bg-white p-1"
          role="group"
        >
          {periods.map((item) => (
            <button
              aria-pressed={period === item.value}
              className={`h-9 px-3 text-sm font-bold transition ${
                period === item.value
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
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
        <p className="text-sm text-slate-500">
          {activePoint
            ? `${formatFullDate(activePoint.checkedAt)} · ${formatPrice(activePoint.price)}`
            : `이 기간 ${data.length}회 관측`}
        </p>
      </div>

      <div className="mt-3 border border-slate-200 bg-white p-2 sm:p-3" ref={ref}>
        {chart && data.length >= 2 ? (
          <svg
            aria-label="기간별 가격 변동 계단 그래프. 마우스나 키보드로 각 시점의 가격을 확인할 수 있습니다."
            height={height}
            onPointerLeave={() => setActiveIndex(null)}
            onPointerMove={selectNearestPoint}
            role="img"
            style={{ touchAction: "pan-y" }}
            viewBox={`0 0 ${width} ${height}`}
            width={width}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {chart.yTicks.map((tick) => (
              <g key={tick.y}>
                <line
                  stroke="#eef2f7"
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={tick.y}
                  y2={tick.y}
                />
                <text
                  fill="#94a3b8"
                  fontSize="11"
                  textAnchor="end"
                  x={paddingLeft - 8}
                  y={tick.y + 4}
                >
                  {formatAxisPrice(tick.price)}
                </text>
              </g>
            ))}

            {chart.referenceLines.map((line) => (
              <g key={line.label}>
                <line
                  stroke={line.color}
                  strokeDasharray="5 5"
                  strokeOpacity="0.75"
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={line.y}
                  y2={line.y}
                />
                <text
                  fill={line.color}
                  fontSize="10"
                  fontWeight="700"
                  x={paddingLeft + 4}
                  y={line.y - 5}
                >
                  {line.label} {formatAxisPrice(line.price)}
                </text>
              </g>
            ))}

            <path
              d={`${chart.path} V${height - paddingBottom} H${chart.coordinates[0].x} Z`}
              fill={`url(#${gradientId})`}
            />
            <path
              d={chart.path}
              fill="none"
              stroke="#059669"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />

            {chart.xTicks.map((tick) => (
              <text
                fill="#94a3b8"
                fontSize="11"
                key={`${tick.x}-${tick.label}`}
                textAnchor={tick.textAnchor}
                x={tick.x}
                y={height - 10}
              >
                {tick.label}
              </text>
            ))}

            {activePoint ? (
              <line
                stroke="#0f172a"
                strokeDasharray="3 4"
                strokeOpacity="0.5"
                x1={activePoint.x}
                x2={activePoint.x}
                y1={paddingTop}
                y2={height - paddingBottom}
              />
            ) : null}

            {/* Only the lowest observation and the hovered one get a visible
                marker. A circle per observation becomes a solid band once a
                product has been tracked for a few weeks. */}
            {chart.coordinates.map((point, index) => {
              const lowest = index === chart.lowestIndex;
              const active = activeIndex === index;

              if (!lowest && !active) {
                return (
                  <circle
                    aria-label={`${formatFullDate(point.checkedAt)}, ${formatPrice(point.price)}`}
                    className="cursor-crosshair outline-none"
                    cx={point.x}
                    cy={point.y}
                    fill="transparent"
                    key={`${point.checkedAt}-${index}`}
                    onBlur={() => setActiveIndex(null)}
                    onFocus={() => setActiveIndex(index)}
                    r="10"
                    tabIndex={0}
                  />
                );
              }

              return (
                <circle
                  cx={point.x}
                  cy={point.y}
                  fill={lowest ? "#e11d48" : "#059669"}
                  key={`${point.checkedAt}-${index}`}
                  r={active ? 6 : 4}
                  stroke="white"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
        ) : data.length >= 2 ? (
          // Measured but not drawn yet. Claiming there is no data here would be
          // a lie: the observations exist and the table below lists them.
          <div aria-hidden className="h-[240px] sm:h-[320px]" />
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="font-bold text-slate-700">
              {points.length === 0
                ? "아직 가격을 수집하지 못했습니다"
                : "이 기간에는 관측이 한 번뿐입니다"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {points.length === 0
                ? "가격이 두 번 이상 확인되면 변동 그래프가 표시됩니다."
                : "기간을 늘리면 더 많은 변동을 볼 수 있습니다."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
