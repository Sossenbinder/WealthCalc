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
    <div className="h-72 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
          accessibilityLayer={false}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
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
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              color: "var(--foreground)",
            }}
            itemStyle={{ color: "var(--foreground)" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
            iconType="square"
          />
          <Area
            type="monotone"
            dataKey="paidIn"
            name="Eingezahlt"
            stackId="balance"
            stroke="var(--muted)"
            fill="var(--muted)"
            fillOpacity={0.25}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="interest"
            name="Zinsertrag"
            stackId="balance"
            stroke="var(--accent)"
            fill="var(--accent)"
            fillOpacity={0.55}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
