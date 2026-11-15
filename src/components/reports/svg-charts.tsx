"use client";

import * as React from "react";

export interface TrendSeriesPoint {
  bucketKey: string;
  label: string;
  primaryValue: number;
  secondaryValue?: number;
}

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  sublabel?: string;
}

export interface StackedBarPoint {
  bucketKey: string;
  label: string;
  firstValue: number;
  secondValue: number;
}

export interface HorizontalBarItem {
  key: string;
  label: string;
  value: number;
  maxValue?: number;
  displayValue: string;
  sublabel?: string;
  colorClass?: string;
}

function buildNiceTicks(maxValue: number): number[] {
  const safeMax = Math.max(4, Math.ceil(maxValue));
  const step = Math.max(1, Math.ceil(safeMax / 4));
  return [0, step, step * 2, step * 3, step * 4];
}

/**
 * Pure React + SVG + Tailwind dual-line time-series chart (DEC-056).
 */
export function SvgDualLineTrendChart({
  title,
  ariaLabel,
  points,
  primaryLabel,
  secondaryLabel,
  primaryColor = "#059669",
  secondaryColor = "#0284c7",
  emptyMessage = "Không có dữ liệu trong khoảng thời gian đã chọn.",
}: {
  title?: string;
  ariaLabel: string;
  points: TrendSeriesPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  emptyMessage?: string;
}) {
  if (points.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const width = 720;
  const height = 250;
  const pad = { top: 18, right: 20, bottom: 38, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxDataVal = Math.max(
    1,
    ...points.map((p) => Math.max(p.primaryValue, p.secondaryValue ?? 0))
  );
  const ticks = buildNiceTicks(maxDataVal);
  const yMax = ticks[ticks.length - 1];

  const getX = (idx: number) =>
    points.length <= 1 ? pad.left + plotW / 2 : pad.left + (idx / (points.length - 1)) * plotW;
  const getY = (val: number) => pad.top + plotH - (val / yMax) * plotH;

  const primaryPath = points
    .map(
      (pt, idx) =>
        `${idx === 0 ? "M" : "L"}${getX(idx).toFixed(1)},${getY(pt.primaryValue).toFixed(1)}`
    )
    .join(" ");

  const hasSecondary = Boolean(secondaryLabel);
  const secondaryPath = hasSecondary
    ? points
        .map(
          (pt, idx) =>
            `${idx === 0 ? "M" : "L"}${getX(idx).toFixed(1)},${getY(pt.secondaryValue ?? 0).toFixed(1)}`
        )
        .join(" ")
    : "";

  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  const showPointDots = points.length <= 45;

  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-medium text-slate-800">{title}</p>}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: primaryColor }}
          />
          {primaryLabel}
        </span>
        {hasSecondary && secondaryLabel && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: secondaryColor }}
            />
            {secondaryLabel}
          </span>
        )}
      </div>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          className="h-auto w-full min-w-[420px] select-none"
        >
          {/* Y grid & labels */}
          {ticks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray={tick === 0 ? undefined : "3 3"}
                />
                <text
                  x={pad.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[11px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Secondary line (e.g. Created) */}
          {hasSecondary && secondaryPath && (
            <path
              d={secondaryPath}
              fill="none"
              stroke={secondaryColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5 3"
            />
          )}

          {/* Primary line (e.g. Completed) */}
          <path
            d={primaryPath}
            fill="none"
            stroke={primaryColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Point markers with native SVG accessible tooltip */}
          {showPointDots &&
            points.map((pt, idx) => (
              <g key={pt.bucketKey}>
                {hasSecondary && (
                  <circle
                    cx={getX(idx)}
                    cy={getY(pt.secondaryValue ?? 0)}
                    r={3.5}
                    fill={secondaryColor}
                    className="stroke-white"
                    strokeWidth={1.2}
                  >
                    <title>
                      {pt.label}: {secondaryLabel} {pt.secondaryValue ?? 0}
                    </title>
                  </circle>
                )}
                <circle
                  cx={getX(idx)}
                  cy={getY(pt.primaryValue)}
                  r={4}
                  fill={primaryColor}
                  className="stroke-white"
                  strokeWidth={1.5}
                >
                  <title>
                    {pt.label}: {primaryLabel} {pt.primaryValue}
                    {hasSecondary ? ` | ${secondaryLabel} ${pt.secondaryValue ?? 0}` : ""}
                  </title>
                </circle>
              </g>
            ))}

          {/* X labels */}
          {points.map((pt, idx) => {
            if (idx % labelStep !== 0 && idx !== points.length - 1) {
              return null;
            }
            return (
              <text
                key={`lbl-${pt.bucketKey}`}
                x={getX(idx)}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-500 text-[10.5px]"
              >
                {pt.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * Pure React + SVG Donut Chart + Accessible Side Legend (DEC-056).
 */
export function SvgDonutChart({
  ariaLabel,
  centerLabel,
  slices,
  emptyMessage = "Chưa có dữ liệu.",
}: {
  ariaLabel: string;
  centerLabel: string;
  slices: DonutSlice[];
  emptyMessage?: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const radius = 56;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;
  const segments = slices
    .filter((slice) => slice.value > 0)
    .reduce<{
      accFraction: number;
      items: Array<{
        slice: DonutSlice;
        fraction: number;
        dashLength: number;
        dashOffset: number;
      }>;
    }>(
      (state, slice) => {
        const fraction = slice.value / total;
        const dashLength = fraction * circumference;
        const dashOffset = -state.accFraction * circumference;
        state.items.push({ slice, fraction, dashLength, dashOffset });
        state.accFraction += fraction;
        return state;
      },
      { accFraction: 0, items: [] }
    ).items;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <svg viewBox="0 0 160 160" role="img" aria-label={ariaLabel} className="h-40 w-40 shrink-0">
        <circle
          cx={80}
          cy={80}
          r={radius}
          fill="transparent"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        {segments.map(({ slice, fraction, dashLength, dashOffset }) => (
          <circle
            key={slice.key}
            cx={80}
            cy={80}
            r={radius}
            fill="transparent"
            stroke={slice.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 80 80)"
          >
            <title>
              {slice.label}: {slice.value} ({Math.round(fraction * 1000) / 10}%)
            </title>
          </circle>
        ))}
        <text x={80} y={76} textAnchor="middle" className="fill-slate-900 text-xl font-bold">
          {total}
        </text>
        <text
          x={80}
          y={94}
          textAnchor="middle"
          className="fill-slate-500 text-[10px] font-medium uppercase"
        >
          {centerLabel}
        </text>
      </svg>

      <div className="w-full space-y-2">
        {slices.map((slice) => {
          const pct = Math.round((slice.value / total) * 1000) / 10;
          return (
            <div key={slice.key} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="font-medium text-slate-800">{slice.label}</span>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <span className="font-semibold text-slate-900">{slice.value}</span> ({pct}%)
                {slice.sublabel ? ` · ${slice.sublabel}` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Pure React + SVG Stacked Column Chart (DEC-056).
 */
export function SvgStackedBarChart({
  ariaLabel,
  points,
  firstLabel,
  secondLabel,
  firstColor = "#059669",
  secondColor = "#e11d48",
  emptyMessage = "Chưa có dữ liệu phát sinh trong khoảng thời gian đã chọn.",
}: {
  ariaLabel: string;
  points: StackedBarPoint[];
  firstLabel: string;
  secondLabel: string;
  firstColor?: string;
  secondColor?: string;
  emptyMessage?: string;
}) {
  const hasAnyValue = points.some((p) => p.firstValue + p.secondValue > 0);
  if (points.length === 0 || !hasAnyValue) {
    return (
      <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const width = 720;
  const height = 220;
  const pad = { top: 16, right: 18, bottom: 36, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxStack = Math.max(1, ...points.map((p) => p.firstValue + p.secondValue));
  const ticks = buildNiceTicks(maxStack);
  const yMax = ticks[ticks.length - 1];
  const slotW = plotW / points.length;
  const barW = Math.min(26, Math.max(4, slotW * 0.68));
  const labelStep = Math.max(1, Math.ceil(points.length / 8));

  const getY = (val: number) => pad.top + plotH - (val / yMax) * plotH;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: firstColor }}
          />
          {firstLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: secondColor }}
          />
          {secondLabel}
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          className="h-auto w-full min-w-[420px] select-none"
        >
          {ticks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray={tick === 0 ? undefined : "3 3"}
                />
                <text
                  x={pad.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[11px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {points.map((pt, idx) => {
            const centerX = pad.left + (idx + 0.5) * slotW;
            const barX = centerX - barW / 2;
            const firstH = (pt.firstValue / yMax) * plotH;
            const secondH = (pt.secondValue / yMax) * plotH;
            const baseY = pad.top + plotH;

            return (
              <g key={pt.bucketKey}>
                {pt.firstValue > 0 && (
                  <rect
                    x={barX}
                    y={baseY - firstH}
                    width={barW}
                    height={firstH}
                    rx={2}
                    fill={firstColor}
                  >
                    <title>
                      {pt.label}: {firstLabel} {pt.firstValue}
                    </title>
                  </rect>
                )}
                {pt.secondValue > 0 && (
                  <rect
                    x={barX}
                    y={baseY - firstH - secondH}
                    width={barW}
                    height={secondH}
                    rx={2}
                    fill={secondColor}
                  >
                    <title>
                      {pt.label}: {secondLabel} {pt.secondValue}
                    </title>
                  </rect>
                )}
                {(idx % labelStep === 0 || idx === points.length - 1) && (
                  <text
                    x={centerX}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-slate-500 text-[10.5px]"
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * Accessible horizontal bar breakdown for aging buckets, Sprint completion rates, and workload summaries.
 */
export function HorizontalBreakdownBars({
  items,
  emptyMessage = "Chưa có dữ liệu.",
}: {
  items: HorizontalBarItem[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const fallbackMax = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const cap = Math.max(1, item.maxValue ?? fallbackMax);
        const pct = Math.min(100, Math.max(0, (item.value / cap) * 100));
        return (
          <div key={item.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-800">{item.label}</span>
              <span className="shrink-0 font-semibold text-slate-900">{item.displayValue}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${item.colorClass ?? "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {item.sublabel && <p className="text-[11px] text-muted-foreground">{item.sublabel}</p>}
          </div>
        );
      })}
    </div>
  );
}
