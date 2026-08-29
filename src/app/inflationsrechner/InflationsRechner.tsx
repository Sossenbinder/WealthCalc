"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import {
  formatEuro,
  formatEuroWhole,
  formatMoneyInput,
  formatNumberInput,
  formatPercent,
  parseGermanNumber,
  parseMoney,
} from "@/lib/engine/format";
import { berechneInflation } from "@/lib/engine/finance/inflation";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULTS = { betrag: 10_000_00, inflation: 2, jahre: 20 };
const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

export function InflationsRechner() {
  const [fields, setFields] = useState({
    betrag: formatMoneyInput(DEFAULTS.betrag),
    inflation: formatNumberInput(DEFAULTS.inflation),
    jahre: formatNumberInput(DEFAULTS.jahre),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const betrag = parseMoney(fields.betrag);
    const inflation = parseGermanNumber(fields.inflation);
    const jahre = parseGermanNumber(fields.jahre);
    const range = {
      betrag: outOfRange(betrag, 0, MAX_MONEY),
      inflation: outOfRange(inflation, -50, 50),
      jahre: outOfRange(jahre, 1, 80),
    };
    return {
      values: {
        betrag: betrag ?? DEFAULTS.betrag,
        inflation: inflation ?? DEFAULTS.inflation,
        jahre: Math.round(jahre ?? DEFAULTS.jahre),
      },
      range,
      invalid: {
        betrag: betrag === null || range.betrag,
        inflation: inflation === null || range.inflation,
        jahre: jahre === null || range.jahre,
      },
    };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (p) => {
      setFields({
        betrag: formatMoneyInput(readMoney(p, "b", DEFAULTS.betrag, MAX_MONEY)),
        inflation: formatNumberInput(readNumber(p, "i", DEFAULTS.inflation, -50, 50)),
        jahre: formatNumberInput(Math.round(readNumber(p, "j", DEFAULTS.jahre, 1, 80))),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("b", moneyParam(parsed.values.betrag));
      p.set("i", numberParam(parsed.values.inflation));
      p.set("j", numberParam(parsed.values.jahre));
      return p;
    },
    !incomplete,
    JSON.stringify(parsed.values),
  );

  const r = useMemo(
    () => (incomplete ? null : berechneInflation(parsed.values)),
    [incomplete, parsed.values],
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField
          id="betrag"
          label="Betrag heute"
          suffix="€"
          value={fields.betrag}
          onChange={set("betrag")}
          invalid={parsed.invalid.betrag}
          error="Bitte eine Zahl eingeben."
        />
        <NumberField
          id="inflation"
          label="Inflation pro Jahr"
          suffix="%"
          value={fields.inflation}
          onChange={set("inflation")}
          invalid={parsed.invalid.inflation}
          hint="Das Ziel der EZB liegt bei 2 %."
          error={
            parsed.range.inflation ? "Zwischen -50 und 50 %." : "Bitte eine Zahl eingeben."
          }
        />
        <NumberField
          id="jahre"
          label="Zeitraum"
          suffix="Jahre"
          value={fields.jahre}
          onChange={set("jahre")}
          invalid={parsed.invalid.jahre}
          error={
            parsed.range.jahre ? "Zwischen 1 und 80 Jahren." : "Bitte eine Zahl eingeben."
          }
        />
      </form>

      <div className="order-1 rounded-xl border border-border bg-surface p-5 lg:col-start-2 lg:row-start-1">
        <p className="text-sm text-muted">
          Kaufkraft nach {parsed.values.jahre}{" "}
          {parsed.values.jahre === 1 ? "Jahr" : "Jahren"}
        </p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatEuro(r.kaufkraftAmEnde)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              von heute {formatEuro(parsed.values.betrag)} — das sind{" "}
              {/* Bei Deflation steigt die Kaufkraft; "-22 % weniger" wäre Unsinn. */}
              {formatPercent(Math.abs(r.verlustProzent), 1)}{" "}
              {r.verlustProzent < 0 ? "mehr" : "weniger"}
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Dann nötig</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(r.benoetigtAmEnde)}
                </dd>
                <p className="text-xs text-muted">
                  um zu kaufen, was heute {formatEuro(parsed.values.betrag)} kostet
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">
                  {r.kaufkraftverlust < 0 ? "Kaufkraftgewinn" : "Kaufkraftverlust"}
                </dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(Math.abs(r.kaufkraftverlust))}
                </dd>
                <p className="text-xs text-muted">
                  {r.kaufkraftverlust < 0
                    ? "bei fallenden Preisen"
                    : "gemessen in heutigem Geld"}
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Halbwertszeit</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {r.halbwertszeit === null
                    ? "—"
                    : `${formatNumberInput(Math.round(r.halbwertszeit * 10) / 10)} Jahre`}
                </dd>
                <p className="text-xs text-muted">
                  {r.halbwertszeit === null
                    ? "nur bei steigenden Preisen sinnvoll"
                    : "bis nur noch die Hälfte übrig ist"}
                </p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={JSON.stringify(parsed.values)} />
          </>
        )}
      </div>

      {r === null ? null : (
        <div className="order-3 overflow-x-auto rounded-xl border border-border bg-surface lg:col-start-2 lg:row-start-2">
          <table className="w-full min-w-xl text-right text-sm tabular-nums">
            <caption className="border-b border-border px-4 py-3 text-left font-medium">
              Jahr für Jahr
            </caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Jahr</th>
                <th scope="col" className="px-4 py-2 font-medium">Kaufkraft</th>
                <th scope="col" className="px-4 py-2 font-medium">Dann nötig</th>
              </tr>
            </thead>
            <tbody>
              {r.jahre.map((row) => (
                <tr key={row.jahr} className="border-t border-border">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {row.jahr}
                  </th>
                  <td className="px-4 py-2 font-medium">{formatEuroWhole(row.kaufkraft)}</td>
                  <td className="px-4 py-2 text-accent">{formatEuroWhole(row.benoetigt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
