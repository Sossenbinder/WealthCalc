"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";
import type { Histogramm } from "@/lib/engine/finance/monte-carlo";
import { formatEuroWhole, formatPercent } from "@/lib/engine/format";

interface VerteilungProps {
  histogramm: Histogramm;
  anzahl: number;
  /** Position of the selected path in the ranking, to highlight its bar. */
  ausgewaehlterRang: number;
  /** Called with a position in the ranking when a bar is clicked. */
  onWaehle: (rang: number) => void;
}

interface Balken {
  label: string;
  prozent: number;
  anzahl: number;
  rangVon: number;
  rangBis: number;
  leer: boolean;
  bereich: string;
}

const euro = (wert: number) => formatEuroWhole(Math.round(wert * 100));

/**
 * The distribution of the end capital, one bar per class of round width.
 *
 * Clicking a bar picks the middle path of that class for the detail view — the
 * histogram is how a reader finds "the paths that ended around 300.000 €" and
 * then looks at one of them. Paths that ran dry get a bar of their own, ahead
 * of the rest, in the error colour: a depot at zero is not the low end of the
 * same scale.
 *
 * Presentational like the other charts: the percentile slider beside it is the
 * keyboard-accessible way to the same paths.
 */
export default function Verteilung({
  histogramm,
  anzahl,
  ausgewaehlterRang,
  onWaehle,
}: VerteilungProps) {
  const compact = new Intl.NumberFormat("de-DE", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });

  const data: Balken[] = [];
  if (histogramm.leer > 0) {
    data.push({
      label: "leer",
      prozent: (histogramm.leer / anzahl) * 100,
      anzahl: histogramm.leer,
      rangVon: 0,
      rangBis: histogramm.leer - 1,
      leer: true,
      bereich: "Depot vor dem Ende aufgebraucht",
    });
  }
  for (const k of histogramm.klassen) {
    data.push({
      label: compact.format(k.von),
      prozent: (k.anzahl / anzahl) * 100,
      anzahl: k.anzahl,
      rangVon: k.rangVon,
      rangBis: k.rangBis,
      leer: false,
      bereich: k.offenUnten
        ? `unter ${euro(k.bis)}`
        : k.offenOben
          ? `ab ${euro(k.von)}`
          : `${euro(k.von)} bis ${euro(k.bis)}`,
    });
  }

  const enthaeltAuswahl = (b: Balken) =>
    b.anzahl > 0 && ausgewaehlterRang >= b.rangVon && ausgewaehlterRang <= b.rangBis;

  const Form = (props: BarShapeProps) => {
    const b = data[props.index];
    if (!b) return <g />;
    const gewaehlt = enthaeltAuswahl(b);
    const farbe = b.leer ? "var(--error)" : "var(--accent)";
    const spalte = props.background;
    // The whole column is the click target, not just the bar: a class in the
    // tail holds a handful of paths and its bar is a pixel tall. Wired here
    // rather than through the chart's onClick, whose tooltip index lags the
    // pointer — a tap on a phone, with no hover before it, picked the column
    // the tooltip had last been on.
    return (
      <g
        onClick={b.anzahl > 0 ? () => onWaehle(Math.round((b.rangVon + b.rangBis) / 2)) : undefined}
        style={{ cursor: b.anzahl > 0 ? "pointer" : "default" }}
      >
        {spalte ? (
          <rect
            x={spalte.x ?? undefined}
            y={spalte.y ?? undefined}
            width={spalte.width}
            height={spalte.height}
            fill="transparent"
            pointerEvents="all"
          />
        ) : null}
        <rect
        x={props.x}
        y={props.y}
        width={Math.max(Number(props.width) - 1, 1)}
        height={props.height}
        rx={2}
        fill={farbe}
        fillOpacity={gewaehlt ? 1 : b.leer ? 0.7 : 0.35}
        />
      </g>
    );
  };

  return (
    <div className="h-64 w-full sm:h-72" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
          barCategoryGap={0}
          accessibilityLayer={false}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            stroke="var(--border)"
            tickMargin={8}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            stroke="var(--border)"
            width={44}
            tickFormatter={(v: number) => `${formatPercent(v, 0)}`}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              const b = active ? (payload?.[0]?.payload as Balken | undefined) : undefined;
              if (!b) return null;
              const darueber = ((anzahl - 1 - b.rangBis) / anzahl) * 100;
              return (
                <div
                  className="rounded-xl border border-border bg-surface px-3 py-2 text-xs"
                  style={{ boxShadow: "var(--shadow-md)" }}
                >
                  <p className="font-medium text-foreground">{b.bereich}</p>
                  <p className="text-muted">
                    {formatPercent(b.prozent, 1)} der Verläufe ({b.anzahl.toLocaleString("de-DE")})
                  </p>
                  {b.anzahl > 0 && !b.leer ? (
                    <p className="text-muted">{formatPercent(darueber, 1)} enden höher</p>
                  ) : null}
                  {b.anzahl > 0 ? (
                    <p className="mt-1 text-accent">Klicken, um einen davon anzusehen</p>
                  ) : null}
                </div>
              );
            }}
          />
          <Bar
            dataKey="prozent"
            isAnimationActive={false}
            shape={Form}
            // Only so Recharts computes each column's full-height rectangle,
            // which the shape above uses as its click target.
            background={{ fill: "transparent" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
