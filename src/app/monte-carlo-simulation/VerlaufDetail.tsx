"use client";

import type { MonteCarloJahr, PfadDetail } from "@/lib/engine/finance/monte-carlo";
import { formatEuroWhole, formatNumber, formatPercent } from "@/lib/engine/format";

interface VerlaufDetailProps {
  detail: PfadDetail;
  jahre: MonteCarloJahr[];
  real: boolean;
  ansparJahre: number;
  mitEntnahme: boolean;
  anzahl: number;
  /** 0 = worst path, 100 = best; may carry a decimal after a histogram click. */
  perzentil: number;
  onPerzentil: (p: number) => void;
}

const SCHNELLWAHL: [string, number][] = [
  ["Schlechtester", 0],
  ["5 %", 5],
  ["10 %", 10],
  ["25 %", 25],
  ["Median", 50],
  ["75 %", 75],
  ["90 %", 90],
  ["95 %", 95],
  ["Bester", 100],
];

/** +7,3 % / −12,0 % with a real minus sign. */
function rendite(r: number): string {
  const text = formatPercent(Math.abs(r) * 100, 1);
  return r < 0 ? `−${text}` : `+${text}`;
}

function jahreText(jahre: number): string {
  const gerundet = Math.round(jahre * 2) / 2;
  return `${formatNumber(gerundet, gerundet % 1 === 0 ? 0 : 1)} ${gerundet === 1 ? "Jahr" : "Jahren"}`;
}

export function perzentilText(p: number, anzahl: number): string {
  if (p <= 0) return `Der schlechteste von ${anzahl.toLocaleString("de-DE")} Verläufen`;
  if (p >= 100) return `Der beste von ${anzahl.toLocaleString("de-DE")} Verläufen`;
  const stellen = p % 1 === 0 ? 0 : (p * 10) % 1 === 0 ? 1 : 2;
  const zahl = formatNumber(p, stellen);
  const rest = formatNumber(100 - p, stellen);
  return `${zahl}. Perzentil: ${zahl} % der Verläufe enden schlechter, ${rest} % besser`;
}

/**
 * One simulated path, looked at closely: which percentile of the outcomes it
 * is, what the fund did in each of its years, and how deep its worst fall was.
 *
 * The bands answer "how wide is the range"; this answers "what does a bad
 * outcome actually look like" — whether the 10 % path is a crash in year 3 or
 * twenty mediocre years, which matters a great deal once withdrawals start.
 */
export function VerlaufDetail({
  detail,
  jahre,
  real,
  ansparJahre,
  mitEntnahme,
  anzahl,
  perzentil,
  onPerzentil,
}: VerlaufDetailProps) {
  const zeige = (cents: number, jahr: number) =>
    formatEuroWhole(real ? Math.round(cents / jahre[jahr].deflator) : cents);
  const letztes = detail.salden.length - 1;
  const gesamtJahre = detail.renditen.length;

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Verlauf schnell wählen">
          {SCHNELLWAHL.map(([label, p]) => (
            <button
              key={p}
              type="button"
              className="chip"
              aria-pressed={perzentil === p}
              onClick={() => onPerzentil(p)}
            >
              {label}
            </button>
          ))}
        </div>
        <label htmlFor="perzentil" className="text-sm font-medium">
          {perzentilText(perzentil, anzahl)}
        </label>
        <input
          id="perzentil"
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(perzentil)}
          onChange={(e) => onPerzentil(Number(e.target.value))}
          aria-valuetext={perzentilText(perzentil, anzahl)}
          className="w-full"
          style={{ accentColor: "var(--accent)" }}
        />
      </div>

      <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))]">
        <div>
          <dt className="text-sm text-muted">Am Ende</dt>
          <dd className="text-lg font-medium tabular-nums">
            {detail.leerNachJahren === null ? (
              zeige(detail.salden[letztes], letztes)
            ) : (
              <span className="text-error">Leer</span>
            )}
          </dd>
          <p className="text-xs text-muted">
            {detail.leerNachJahren === null
              ? `nach ${gesamtJahre} ${gesamtJahre === 1 ? "Jahr" : "Jahren"}`
              : `nach ${jahreText(detail.leerNachJahren)} Entnahme`}
          </p>
        </div>
        {mitEntnahme && ansparJahre > 0 ? (
          <div>
            <dt className="text-sm text-muted">Bei Rentenbeginn</dt>
            <dd className="text-lg font-medium tabular-nums">
              {zeige(detail.salden[ansparJahre], ansparJahre)}
            </dd>
            <p className="text-xs text-muted">nach {ansparJahre} Jahren Ansparen</p>
          </div>
        ) : null}
        <div>
          <dt className="text-sm text-muted">ETF-Rendite p. a.</dt>
          <dd className="text-lg font-medium tabular-nums">
            {rendite(detail.renditeProJahr)}
          </dd>
          <p className="text-xs text-muted">im Schnitt, nach Kosten</p>
        </div>
        {detail.besteJahr ? (
          <div>
            <dt className="text-sm text-muted">Bestes Jahr</dt>
            <dd className="text-lg font-medium tabular-nums">
              {rendite(detail.besteJahr.rendite)}
            </dd>
            <p className="text-xs text-muted">Jahr {detail.besteJahr.jahr}</p>
          </div>
        ) : null}
        {detail.schlechtesteJahr ? (
          <div>
            <dt className="text-sm text-muted">Schlechtestes Jahr</dt>
            <dd className="text-lg font-medium tabular-nums">
              {rendite(detail.schlechtesteJahr.rendite)}
            </dd>
            <p className="text-xs text-muted">Jahr {detail.schlechtesteJahr.jahr}</p>
          </div>
        ) : null}
        <div>
          <dt className="text-sm text-muted">Größter Einbruch</dt>
          <dd className="text-lg font-medium tabular-nums">
            {detail.maxDrawdown === 0 ? "—" : rendite(-detail.maxDrawdown)}
          </dd>
          <p className="text-xs text-muted">
            {detail.drawdownTiefJahr === null
              ? "kein Rückgang"
              : `vom Hoch, Tiefpunkt in Jahr ${detail.drawdownTiefJahr}`}
          </p>
        </div>
      </dl>

      <div className="table-scroll mt-5 rounded-xl border border-border">
        <table className="data-table w-full min-w-md text-right text-sm tabular-nums">
          <caption className="sr-only">
            Dieser Verlauf Jahr für Jahr{real ? ", in heutiger Kaufkraft" : ""}
          </caption>
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium">Jahr</th>
              <th scope="col" className="px-4 py-2 font-medium">ETF-Rendite</th>
              <th scope="col" className="px-4 py-2 font-medium">Kapital</th>
              <th scope="col" className="px-4 py-2 font-medium">Median aller</th>
            </tr>
          </thead>
          <tbody>
            {detail.renditen.map((r, index) => {
              const jahr = index + 1;
              const kapital = detail.salden[jahr];
              const median = jahre[jahr].perzentile[50];
              return (
                <tr key={jahr} className="border-t border-border">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {jahr}
                    {mitEntnahme && jahr === ansparJahre + 1 ? (
                      <span className="ml-2 text-xs text-muted">Entnahme</span>
                    ) : null}
                  </th>
                  <td className={`px-4 py-2 ${r < 0 ? "text-error" : ""}`}>{rendite(r)}</td>
                  <td className={`px-4 py-2 font-medium ${kapital >= median ? "" : "text-muted"}`}>
                    {kapital === 0 && detail.leerNachJahren !== null ? "leer" : zeige(kapital, jahr)}
                  </td>
                  <td className="px-4 py-2 text-muted">{zeige(median, jahr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
