"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SparplanYear } from "@/lib/engine/finance/zinseszins";
import { formatEuro } from "@/lib/engine/format";

interface GrowthChartProps {
  years: SparplanYear[];
}

/**
 * Contributions and interest, stacked to the running balance.
 *
 * Stacking is exact rather than decorative: the engine guarantees
 * `totalPaidIn + totalInterest === closingBalance` for every year, so the two
 * bands always add up to the line the table reports. It also makes the one
 * thing people come to a Zinseszinsrechner to see legible at a glance — the
 * year the interest band overtakes what you have actually paid in.
 */
export default function GrowthChart({ years }: GrowthChartProps) {
  const data = years.map((row) => ({
    year: row.year,
    paidIn: row.totalPaidIn / 100,
    interest: row.totalInterest / 100,
  }));

  const compactEuro = new Intl.NumberFormat("de-DE", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 0,
  });

  return (
    // The chart restates the table that follows it, so it is presentational:
    // Recharts' accessibility layer would otherwise put an unnamed
    // role="application" region in the tab order, where a screen reader finds
    // nothing but run-together axis digits. The table is the accessible form
    // of this data.
    <div className="h-72 w-full sm:h-80" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
          accessibilityLayer={false}
        >
          {/* Filled bands rather than flat colour: the interest band is the
              thing being read, and a gradient keeps it legible where it is thin
              in the early years without darkening the whole area. */}
          <defs>
            <linearGradient id="wc-paid-in" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--muted)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--muted)" stopOpacity={0.12} />
            </linearGradient>
            <linearGradient id="wc-interest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.7} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            stroke="var(--border)"
            tickMargin={8}
            label={{
              value: "Jahr",
              position: "insideBottomRight",
              offset: -2,
              fill: "var(--muted)",
              fontSize: 12,
            }}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            stroke="var(--border)"
            width={64}
            tickFormatter={(value: number) => compactEuro.format(value)}
          />
          <Tooltip
            formatter={(value, name) => [
              formatEuro(Math.round(Number(value) * 100)),
              name,
            ]}
            labelFormatter={(year) => `Jahr ${year}`}
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              boxShadow: "var(--shadow-md)",
              padding: "0.5rem 0.75rem",
              color: "var(--foreground)",
            }}
            itemStyle={{ color: "var(--foreground)" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--muted)", paddingTop: 8 }}
            iconType="circle"
            iconSize={9}
          />
          <Area
            type="monotone"
            dataKey="paidIn"
            name="Eingezahlt"
            stackId="balance"
            stroke="var(--muted)"
            strokeWidth={1.5}
            fill="url(#wc-paid-in)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="interest"
            name="Zinsertrag"
            stackId="balance"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#wc-interest)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
