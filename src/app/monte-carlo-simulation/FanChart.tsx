"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonteCarloJahr } from "@/lib/engine/finance/monte-carlo";
import { formatEuroWhole } from "@/lib/engine/format";

interface FanChartProps {
  jahre: MonteCarloJahr[];
  /** Divide by each year's deflator: today's purchasing power. */
  real: boolean;
  /** Year the Entnahmephase starts, marked with a line; null without one. */
  entnahmeAb: number | null;
  /** One path's nominal year-end capital, drawn over the bands; null for none. */
  pfad: number[] | null;
  /** Legend name for that path, e.g. "Verlauf am 25. Perzentil". */
  pfadName: string;
}

/**
 * The spread of outcomes year by year: 5–95 % and 25–75 % of the paths as
 * nested bands, the median as a line, and what was paid in for scale.
 *
 * Bands rather than a spray of sample paths: a handful of drawn paths invites
 * reading one of them as the forecast, while the bands say what the simulation
 * actually knows. The one path drawn on top is the one the reader picked, and
 * it is drawn straight rather than smoothed — its kinks are the bad years.
 */
export default function FanChart({ jahre, real, entnahmeAb, pfad, pfadName }: FanChartProps) {
  const euro = (cents: number, deflator: number) =>
    (real ? cents / deflator : cents) / 100;

  const data = jahre.map((j, index) => ({
    pfad: pfad ? euro(pfad[index] ?? 0, j.deflator) : null,
    jahr: j.jahr,
    aussen: [euro(j.perzentile[5], j.deflator), euro(j.perzentile[95], j.deflator)],
    innen: [euro(j.perzentile[25], j.deflator), euro(j.perzentile[75], j.deflator)],
    median: euro(j.perzentile[50], j.deflator),
    eingezahlt: euro(j.eingezahlt, j.deflator),
  }));

  const compactEuro = new Intl.NumberFormat("de-DE", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });
  const fmt = (value: number) => formatEuroWhole(Math.round(value * 100));

  return (
    // Presentational for the same reason as the Zinseszins chart: the table
    // below carries the same numbers in an accessible form.
    <div className="h-72 w-full sm:h-80" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
          accessibilityLayer={false}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="jahr"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            stroke="var(--border)"
            tickMargin={8}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            stroke="var(--border)"
            width={64}
            tickFormatter={(value: number) => compactEuro.format(value)}
          />
          <Tooltip
            formatter={(value, name) => [
              Array.isArray(value)
                ? `${fmt(Number(value[0]))} – ${fmt(Number(value[1]))}`
                : fmt(Number(value)),
              name,
            ]}
            labelFormatter={(jahr) => `Jahr ${jahr}`}
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
          {entnahmeAb === null ? null : (
            <ReferenceLine
              x={entnahmeAb}
              stroke="var(--border-strong)"
              strokeDasharray="3 3"
              label={{
                value: "Entnahme",
                position: "insideTopLeft",
                fill: "var(--muted)",
                fontSize: 12,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="aussen"
            name="5–95 % der Verläufe"
            stroke="none"
            fill="var(--accent)"
            fillOpacity={0.14}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="innen"
            name="25–75 %"
            stroke="none"
            fill="var(--accent)"
            fillOpacity={0.3}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="median"
            name="Median"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="eingezahlt"
            name="Eingezahlt"
            stroke="var(--muted)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
          {pfad === null ? null : (
            <Line
              type="linear"
              dataKey="pfad"
              name={pfadName}
              stroke="var(--foreground)"
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
