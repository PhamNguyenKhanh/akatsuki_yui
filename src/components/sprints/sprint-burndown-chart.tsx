"use client";

import * as React from "react";
import { AlertCircle, Info, TrendingDown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  BurndownPointDTO,
  SprintAnalyticsDTO,
} from "@/modules/sprints/sprint-analytics.service";

interface SprintBurndownChartProps {
  analytics: SprintAnalyticsDTO;
}

function formatShortDate(ymd: string): string {
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}`;
}

function formatHours(value: number): string {
  return Number.isInteger(value) ? `${value}h` : `${value.toFixed(1)}h`;
}

export function SprintBurndownChart({ analytics }: SprintBurndownChartProps) {
  const { progress, burndown } = analytics;
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(() => {
    const actualPoints = burndown.points
      .map((point, index) => (point.actualRemainingHours !== null ? index : -1))
      .filter((idx) => idx >= 0);
    return actualPoints.length > 0 ? actualPoints[actualPoints.length - 1] : null;
  });

  const width = 760;
  const height = 290;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const points = burndown.points;
  const maxYValue = Math.max(
    1,
    burndown.baselineHours,
    burndown.currentScopeHours,
    ...points.map((p) => Math.max(p.idealRemainingHours, p.actualRemainingHours ?? 0, p.scopeHours))
  );
  const roundedMaxY = Math.ceil(maxYValue / 4) * 4 || Math.ceil(maxYValue);

  const getX = (index: number) => {
    if (points.length <= 1) return padLeft + plotW / 2;
    return padLeft + (index / (points.length - 1)) * plotW;
  };

  const getY = (hours: number) => {
    const ratio = Math.min(1, Math.max(0, hours / roundedMaxY));
    return padTop + plotH * (1 - ratio);
  };

  const idealPolyline = points
    .map((point, idx) => `${getX(idx)},${getY(point.idealRemainingHours)}`)
    .join(" ");

  const actualSegments = points
    .map((point, idx) =>
      point.actualRemainingHours !== null
        ? { idx, point, x: getX(idx), y: getY(point.actualRemainingHours) }
        : null
    )
    .filter(
      (entry): entry is { idx: number; point: BurndownPointDTO; x: number; y: number } =>
        entry !== null
    );

  const actualPolyline = actualSegments.map((seg) => `${seg.x},${seg.y}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    value: Math.round(roundedMaxY * fraction * 10) / 10,
    y: padTop + plotH * (1 - fraction),
  }));

  const xTickStep = Math.max(1, Math.ceil(points.length / 7));
  const xTicks = points
    .map((point, index) => ({ point, index }))
    .filter(({ index }) => index === 0 || index === points.length - 1 || index % xTickStep === 0);

  const inspectedPoint =
    selectedIndex !== null && points[selectedIndex] ? points[selectedIndex] : null;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-5 w-5 text-slate-700" />
              <span>Tiến độ Sprint &amp; Burndown Chart</span>
            </CardTitle>
            <CardDescription>
              Tiến độ tính theo số lượng Task hoàn thành ({progress.doneCount}/{progress.totalTasks}{" "}
              Task). Burndown Chart ước lượng theo giờ làm việc ({burndown.timezone}, UTC+07:00).
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit font-mono text-xs">
            {analytics.startDate} → {analytics.endDate}
          </Badge>
        </div>

        {/* Sprint Task Progress Bar (strictly DONE Tasks / Total Tasks per DEC-033) */}
        <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between text-xs font-medium text-slate-700">
            <span>Tiến độ hoàn thành theo Task (DONE / Tổng Task)</span>
            <span className="font-mono font-semibold text-slate-900">
              {progress.progressPercent}% ({progress.doneCount}/{progress.totalTasks} Task)
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến độ hoàn thành Sprint"
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress.progressPercent))}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {burndown.insufficientDataMessage && (
          <Alert variant={burndown.hasEstimateData ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {burndown.hasEstimateData
                ? "Dữ liệu Estimate Hours chưa đầy đủ"
                : "Chưa đủ dữ liệu để vẽ Burndown Chart"}
            </AlertTitle>
            <AlertDescription>{burndown.insufficientDataMessage}</AlertDescription>
          </Alert>
        )}

        {burndown.hasEstimateData && points.length > 0 && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Baseline ban đầu</p>
                <p className="text-base font-semibold text-slate-900">
                  {formatHours(burndown.baselineHours)}
                </p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">Scope hiện tại</p>
                <p className="text-base font-semibold text-slate-900">
                  {formatHours(burndown.currentScopeHours)}
                </p>
              </div>
              <div className="rounded-md border border-border bg-emerald-50/60 px-3 py-2">
                <p className="text-xs text-emerald-700">Đã hoàn thành (Estimate)</p>
                <p className="text-base font-semibold text-emerald-900">
                  {formatHours(burndown.completedEstimateHours)}
                </p>
              </div>
              <div className="rounded-md border border-border bg-sky-50/60 px-3 py-2">
                <p className="text-xs text-sky-700">Còn lại (Estimate)</p>
                <p className="text-base font-semibold text-sky-900">
                  {formatHours(burndown.remainingEstimateHours)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-slate-400" />
                    Ideal Remaining
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-800 font-medium">
                    <span className="inline-block h-0.5 w-5 bg-teal-700" />
                    Actual Remaining
                  </span>
                </div>
                {inspectedPoint && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">
                    Ngày {formatShortDate(inspectedPoint.date)} · Ideal:{" "}
                    {formatHours(inspectedPoint.idealRemainingHours)} · Actual:{" "}
                    {inspectedPoint.actualRemainingHours !== null
                      ? formatHours(inspectedPoint.actualRemainingHours)
                      : "Chưa tới"}
                  </span>
                )}
              </div>

              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="h-auto min-w-[540px] w-full select-none"
                role="img"
                aria-label={`Burndown Chart cho ${analytics.sprintName}`}
              >
                {/* Horizontal gridlines and Y axis labels */}
                {yTicks.map((tick) => (
                  <g key={tick.value}>
                    <line
                      x1={padLeft}
                      y1={tick.y}
                      x2={width - padRight}
                      y2={tick.y}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                    />
                    <text
                      x={padLeft - 8}
                      y={tick.y + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#64748b"
                    >
                      {formatHours(tick.value)}
                    </text>
                  </g>
                ))}

                {/* Axes */}
                <line
                  x1={padLeft}
                  y1={padTop}
                  x2={padLeft}
                  y2={padTop + plotH}
                  stroke="#94a3b8"
                  strokeWidth={1.2}
                />
                <line
                  x1={padLeft}
                  y1={padTop + plotH}
                  x2={width - padRight}
                  y2={padTop + plotH}
                  stroke="#94a3b8"
                  strokeWidth={1.2}
                />

                {/* Ideal burndown line */}
                {points.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    points={idealPolyline}
                  />
                )}

                {/* Actual remaining line */}
                {actualSegments.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#0f766e"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={actualPolyline}
                  />
                )}

                {/* Ideal data nodes for quick inspection */}
                {points.map((point, index) => (
                  <circle
                    key={`ideal-${point.date}`}
                    cx={getX(index)}
                    cy={getY(point.idealRemainingHours)}
                    r={selectedIndex === index ? 4 : 2.5}
                    fill="#94a3b8"
                    className="cursor-pointer"
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => setSelectedIndex(index)}
                  />
                ))}

                {/* Actual data points */}
                {actualSegments.map((seg) => (
                  <g key={`actual-${seg.point.date}`}>
                    <circle
                      cx={seg.x}
                      cy={seg.y}
                      r={selectedIndex === seg.idx ? 6 : 4}
                      fill="#0f766e"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="cursor-pointer"
                      tabIndex={0}
                      aria-label={`Ngày ${seg.point.date}: còn lại ${seg.point.actualRemainingHours} giờ`}
                      onMouseEnter={() => setSelectedIndex(seg.idx)}
                      onFocus={() => setSelectedIndex(seg.idx)}
                      onClick={() => setSelectedIndex(seg.idx)}
                    />
                  </g>
                ))}

                {/* X-axis ticks */}
                {xTicks.map(({ point, index }) => (
                  <text
                    key={`x-${point.date}`}
                    x={getX(index)}
                    y={padTop + plotH + 20}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#64748b"
                  >
                    {formatShortDate(point.date)}
                  </text>
                ))}
              </svg>
            </div>
          </div>
        )}

        {burndown.limitations.length > 0 && (
          <div className="rounded-md border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
              <Info className="h-3.5 w-3.5" />
              <span>Lưu ý &amp; giới hạn tính toán Burndown</span>
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {burndown.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
