"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import {
  formatEuro,
  formatEuroWhole,
  formatMoneyInput,
  formatNumberInput,
  parseGermanNumber,
  parseMoney,
} from "@/lib/engine/format";
import {
  berechneEntnahmeplan,
  solveEntnahme,
} from "@/lib/engine/finance/entnahmeplan";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
type Modus = "dauer" | "rate";
const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

const DEFAULTS = {
  startkapital: 500_000_00,
  monatlicheEntnahme: 2_000_00,
  rendite: 5,
  inflation: 2,
  jahre: 30,
};

export function EntnahmeplanRechner() {
  const [modus, setModus] = useState<Modus>("dauer");
  const [fields, setFields] = useState({
    startkapital: formatMoneyInput(DEFAULTS.startkapital),
    monatlicheEntnahme: formatMoneyInput(DEFAULTS.monatlicheEntnahme),
    rendite: formatNumberInput(DEFAULTS.rendite),
    inflation: formatNumberInput(DEFAULTS.inflation),
    jahre: formatNumberInput(DEFAULTS.jahre),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const startkapital = parseMoney(fields.startkapital);
    const monatlicheEntnahme = parseMoney(fields.monatlicheEntnahme);
    const rendite = parseGermanNumber(fields.rendite);
    const inflation = parseGermanNumber(fields.inflation);
    const jahre = parseGermanNumber(fields.jahre);
    const range = {
      startkapital: outOfRange(startkapital, 0, MAX_MONEY),
      monatlicheEntnahme: outOfRange(monatlicheEntnahme, 0, MAX_MONEY),
      rendite: outOfRange(rendite, -50, 50),
      inflation: outOfRange(inflation, -50, 50),
      jahre: outOfRange(jahre, 1, 80),
    };
    return {
      values: {
        startkapital: startkapital ?? DEFAULTS.startkapital,
        monatlicheEntnahme: monatlicheEntnahme ?? DEFAULTS.monatlicheEntnahme,
        rendite: rendite ?? DEFAULTS.rendite,
        inflation: inflation ?? DEFAULTS.inflation,
        jahre: Math.round(jahre ?? DEFAULTS.jahre),
      },
      range,
      invalid: {
        startkapital: startkapital === null || range.startkapital,
        monatlicheEntnahme:
          modus === "dauer" &&
          (monatlicheEntnahme === null || range.monatlicheEntnahme),
        rendite: rendite === null || range.rendite,
        inflation: inflation === null || range.inflation,
        jahre: jahre === null || range.jahre,
      },
    };
  }, [fields, modus]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (p) => {
      setModus(p.get("mo") === "rate" ? "rate" : "dauer");
      setFields({
        startkapital: formatMoneyInput(readMoney(p, "k", DEFAULTS.startkapital, MAX_MONEY)),
        monatlicheEntnahme: formatMoneyInput(
          readMoney(p, "e", DEFAULTS.monatlicheEntnahme, MAX_MONEY),
        ),
        rendite: formatNumberInput(readNumber(p, "r", DEFAULTS.rendite, -50, 50)),
        inflation: formatNumberInput(readNumber(p, "i", DEFAULTS.inflation, -50, 50)),
        jahre: formatNumberInput(Math.round(readNumber(p, "j", DEFAULTS.jahre, 1, 80))),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("k", moneyParam(parsed.values.startkapital));
      p.set("e", moneyParam(parsed.values.monatlicheEntnahme));
      p.set("r", numberParam(parsed.values.rendite));
      p.set("i", numberParam(parsed.values.inflation));
      p.set("j", numberParam(parsed.values.jahre));
      if (modus === "rate") p.set("mo", "rate");
      return p;
    },
    !incomplete,
    `${modus}|${JSON.stringify(parsed.values)}`,
  );

  const solvedRate = useMemo(
    () =>
      incomplete || modus !== "rate"
        ? null
        : solveEntnahme({
            startkapital: parsed.values.startkapital,
            rendite: parsed.values.rendite,
            inflation: parsed.values.inflation,
            jahre: parsed.values.jahre,
          }),
    [incomplete, modus, parsed.values],
  );

  const result = useMemo(() => {
    if (incomplete) return null;
    return berechneEntnahmeplan({
      ...parsed.values,
      monatlicheEntnahme:
        modus === "rate" ? (solvedRate ?? 0) : parsed.values.monatlicheEntnahme,
    });
  }, [incomplete, modus, parsed.values, solvedRate]);

  const jahreGehalten = result?.erschoepftNachMonaten
    ? Math.floor(result.erschoepftNachMonaten / 12)
    : null;
  const monateGehalten = result?.erschoepftNachMonaten
    ? result.erschoepftNachMonaten % 12
    : null;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Ich möchte wissen</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))]">
            {(
              [
                ["dauer", "Wie lange"],
                ["rate", "Wie viel"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm has-[:focus-visible]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40 ${
                  modus === value
                    ? "border-accent bg-accent-soft font-medium"
                    : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="modus"
                  value={value}
                  checked={modus === value}
                  onChange={() => setModus(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <NumberField
          id="startkapital"
          label="Startkapital"
          suffix="€"
          value={fields.startkapital}
          onChange={set("startkapital")}
          invalid={parsed.invalid.startkapital}
          error="Bitte eine Zahl eingeben."
        />
        {modus === "dauer" ? (
          <NumberField
            id="monatlicheEntnahme"
            label="Monatliche Entnahme"
            suffix="€"
            value={fields.monatlicheEntnahme}
            onChange={set("monatlicheEntnahme")}
            invalid={parsed.invalid.monatlicheEntnahme}
            error="Bitte eine Zahl eingeben."
          />
        ) : null}
        <NumberField
          id="rendite"
          label="Rendite pro Jahr"
          suffix="%"
          value={fields.rendite}
          onChange={set("rendite")}
          invalid={parsed.invalid.rendite}
          hint="Auf das noch angelegte Kapital."
          error={
            parsed.range.rendite ? "Zwischen -50 und 50 %." : "Bitte eine Zahl eingeben."
          }
        />
        <NumberField
          id="inflation"
          label="Inflation pro Jahr"
          suffix="%"
          value={fields.inflation}
          onChange={set("inflation")}
          invalid={parsed.invalid.inflation}
          hint="Erhöht die Entnahme jedes Jahr."
          error={
            parsed.range.inflation ? "Zwischen -50 und 50 %." : "Bitte eine Zahl eingeben."
          }
        />
        <NumberField
          id="jahre"
          label={modus === "rate" ? "Kapital soll reichen" : "Zeitraum"}
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
          {modus === "rate"
            ? `Dauerhaft entnehmbar über ${parsed.values.jahre} Jahre`
            : "Das Kapital reicht"}
        </p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {result === null
            ? "—"
            : modus === "rate"
              ? formatEuro(solvedRate ?? 0)
              : result.erschoepftNachMonaten === null
                ? "Länger als der Zeitraum"
                : `${jahreGehalten} Jahre, ${monateGehalten} Monate`}
        </p>

        {result === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {modus === "rate"
                ? `im ersten Monat, danach jährlich um die Inflation erhöht`
                : result.erschoepftNachMonaten === null
                  ? `nach ${parsed.values.jahre} Jahren bleiben noch ${formatEuro(result.endkapital)}`
                  : `die Entnahme steigt bis dahin auf ${formatEuro(result.jahre[result.jahre.length - 1].monatlicheEntnahme)} im Monat`}
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Insgesamt entnommen</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(result.gesamtEntnommen)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Davon Rendite</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(
                    Math.max(
                      result.gesamtEntnommen +
                        result.endkapital -
                        parsed.values.startkapital,
                      0,
                    ),
                  )}
                </dd>
                <p className="text-xs text-muted">über das Startkapital hinaus</p>
              </div>
              <div>
                <dt className="text-sm text-muted">Restkapital</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(result.endkapital)}
                </dd>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={`${modus}|${JSON.stringify(parsed.values)}`} />
          </>
        )}
      </div>

      {result === null ? null : (
        <div className="order-3 overflow-x-auto rounded-xl border border-border bg-surface lg:col-start-2 lg:row-start-2">
          <table className="w-full min-w-xl text-right text-sm tabular-nums">
            <caption className="border-b border-border px-4 py-3 text-left font-medium">
              Kapitalverzehr Jahr für Jahr
            </caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Jahr</th>
                <th scope="col" className="px-4 py-2 font-medium">Entnahme mtl.</th>
                <th scope="col" className="px-4 py-2 font-medium">Entnommen</th>
                <th scope="col" className="px-4 py-2 font-medium">Rendite</th>
                <th scope="col" className="px-4 py-2 font-medium">Restkapital</th>
              </tr>
            </thead>
            <tbody>
              {result.jahre.map((row) => (
                <tr
                  key={row.jahr}
                  className={`border-t border-border ${
                    row.endkapital === 0 ? "bg-accent-soft" : ""
                  }`}
                >
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {row.jahr}
                  </th>
                  <td className="px-4 py-2">{formatEuro(row.monatlicheEntnahme)}</td>
                  <td className="px-4 py-2">{formatEuroWhole(row.entnahmen)}</td>
                  <td className="px-4 py-2 text-accent">{formatEuroWhole(row.rendite)}</td>
                  <td className="px-4 py-2 font-medium">{formatEuroWhole(row.endkapital)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
