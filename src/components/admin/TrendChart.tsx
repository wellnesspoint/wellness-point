"use client";

import React, { useMemo, useState } from "react";

export interface TrendPoint {
  label: string;
  value: number;
}

/**
 * Dependency-free bar chart (inline SVG). Hover/focus a bar to read its value.
 * `format` renders values for the axis hint and tooltip.
 */
export default function TrendChart({
  data,
  format = (n: number) => String(n),
  color = "#10b981",
  height = 140,
}: {
  data: TrendPoint[];
  format?: (n: number) => string;
  color?: string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);

  if (data.length === 0) return null;

  const W = 600;
  const gap = data.length > 45 ? 1 : 3;
  const barW = Math.max(1, (W - gap * (data.length - 1)) / data.length);
  const pad = 4;
  const shown = active !== null ? data[active] : null;

  return (
    <div>
      <div className="mb-1 flex h-5 items-center justify-between text-xs text-muted-foreground">
        <span>{shown ? shown.label : `${data[0].label} – ${data[data.length - 1].label}`}</span>
        <span className="font-medium text-foreground">
          {shown ? format(shown.value) : `Peak ${format(max)}`}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Trend chart"
        onMouseLeave={() => setActive(null)}
      >
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(2, (d.value / max) * (height - pad)) : 1;
          return (
            <rect
              key={i}
              x={i * (barW + gap)}
              y={height - h}
              width={barW}
              height={h}
              rx={Math.min(2, barW / 2)}
              fill={color}
              opacity={active === null || active === i ? 1 : 0.45}
              tabIndex={0}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
