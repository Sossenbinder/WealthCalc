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
import { berechneSondertilgung } from "@/lib/engine/finance/sondertilgung";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULTS = {
  darlehensbetrag: 300_000_00,
  sollzins: 3.5,
  anfaenglicheTilgung: 2,
  sondertilgungProJahr: 5_000_00,
};
const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

const jahreUndMonate = (monate: number) =>
  `${Math.floor(monate / 12)} Jahre, ${monate % 12} Monate`;

export function SondertilgungRechner() {
  const [fields, setFields] = useState({
    darlehensbetrag: formatMoneyInput(DEFAULTS.darlehensbetrag),
    sollzins: formatNumberInput(DEFAULTS.sollzins),
    anfaenglicheTilgung: formatNumberInput(DEFAULTS.anfaenglicheTilgung),
    sondertilgungProJahr: formatMoneyInput(DEFAULTS.sondertilgungProJahr),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const darlehensbetrag = parseMoney(fields.darlehensbetrag);
    const sondertilgungProJahr = parseMoney(fields.sondertilgungProJahr);
    const sollzins = parseGermanNumber(fields.sollzins);
    const anfaenglicheTilgung = parseGermanNumber(fields.anfaenglicheTilgung);
    const range = {
      darlehensbetrag: outOfRange(darlehensbetrag, 1, MAX_MONEY),
      sondertilgungProJahr: outOfRange(sondertilgungProJahr, 0, MAX_MONEY),
      sollzins: outOfRange(sollzins, 0, 25),
      anfaenglicheTilgung: outOfRange(anfaenglicheTilgung, 0, 50),
    };
    return {
      values: {
        darlehensbetrag: darlehensbetrag ?? DEFAULTS.darlehensbetrag,
        sondertilgungProJahr:
          sondertilgungProJahr ?? DEFAULTS.sondertilgungProJahr,
        sollzins: sollzins ?? DEFAULTS.sollzins,
        anfaenglicheTilgung:
          anfaenglicheTilgung ?? DEFAULTS.anfaenglicheTilgung,
      },
      range,
      invalid: {
        darlehensbetrag: darlehensbetrag === null || range.darlehensbetrag,
        sondertilgungProJahr:
          sondertilgungProJahr === null || range.sondertilgungProJahr,
        sollzins: sollzins === null || range.sollzins,
        anfaenglicheTilgung:
          anfaenglicheTilgung === null || range.anfaenglicheTilgung,
      },
    };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (p) => {
      setFields({
        darlehensbetrag: formatMoneyInput(readMoney(p, "d", DEFAULTS.darlehensbetrag, MAX_MONEY)),
        sondertilgungProJahr: formatMoneyInput(readMoney(p, "s", DEFAULTS.sondertilgungProJahr, MAX_MONEY)),
        sollzins: formatNumberInput(readNumber(p, "z", DEFAULTS.sollzins, 0, 25)),
        anfaenglicheTilgung: formatNumberInput(readNumber(p, "t", DEFAULTS.anfaenglicheTilgung, 0, 50)),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("d", moneyParam(parsed.values.darlehensbetrag));
      p.set("s", moneyParam(parsed.values.sondertilgungProJahr));
      p.set("z", numberParam(parsed.values.sollzins));
      p.set("t", numberParam(parsed.values.anfaenglicheTilgung));
      return p;
    },
    !incomplete,
    JSON.stringify(parsed.values),
  );

  const r = useMemo(
    () => (incomplete ? null : berechneSondertilgung(parsed.values)),
    [incomplete, parsed.values],
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField id="darlehensbetrag" label="Darlehensbetrag" suffix="€"
          value={fields.darlehensbetrag} onChange={set("darlehensbetrag")}
          invalid={parsed.invalid.darlehensbetrag} error="Bitte eine Zahl eingeben." />
        <NumberField id="sollzins" label="Sollzins pro Jahr" suffix="%"
          value={fields.sollzins} onChange={set("sollzins")}
          invalid={parsed.invalid.sollzins}
          error={parsed.range.sollzins ? "Zwischen 0 und 25 %." : "Bitte eine Zahl eingeben."} />
        <NumberField id="anfaenglicheTilgung" label="Anfängliche Tilgung" suffix="%"
          value={fields.anfaenglicheTilgung} onChange={set("anfaenglicheTilgung")}
          invalid={parsed.invalid.anfaenglicheTilgung}
          error={parsed.range.anfaenglicheTilgung ? "Zwischen 0 und 50 %." : "Bitte eine Zahl eingeben."} />
        <NumberField id="sondertilgungProJahr" label="Sondertilgung pro Jahr" suffix="€"
          value={fields.sondertilgungProJahr} onChange={set("sondertilgungProJahr")}
          invalid={parsed.invalid.sondertilgungProJahr}
          hint="Viele Verträge erlauben 5 % der Darlehenssumme im Jahr."
          error="Bitte eine Zahl eingeben." />
      </form>

      <div className="order-1 rounded-xl border border-border bg-surface p-5 lg:col-start-2 lg:row-start-1">
        <p className="text-sm text-muted">Gesparte Zinsen</p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : r.tilgtNie ? "Tilgt nie" : formatEuro(r.zinsersparnis)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : r.tilgtNie ? (
          <p className="mt-1 text-sm text-muted">
            Die Rate deckt nicht einmal die Zinsen des ersten Monats — erhöhe
            zuerst die anfängliche Tilgung.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              und {jahreUndMonate(r.zeitersparnisMonate)} früher schuldenfrei —
              statt {jahreUndMonate(r.ohne.laufzeitMonate)} nur{" "}
              {jahreUndMonate(r.mit.laufzeitMonate)}
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Eingesetzt</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.eingesetzteSondertilgung)}
                </dd>
                <p className="text-xs text-muted">
                  {formatEuro(parsed.values.sondertilgungProJahr)} im Jahr
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Je Euro Sondertilgung</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatNumberInput(Math.round(r.ersparnisJeEuro * 100) / 100)} €
                </dd>
                <p className="text-xs text-muted">an gesparten Zinsen</p>
              </div>
              <div>
                <dt className="text-sm text-muted">Monatsrate</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.monatsrate)}
                </dd>
                <p className="text-xs text-muted">bleibt unverändert</p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={JSON.stringify(parsed.values)} />
          </>
        )}
      </div>

      {r === null || r.tilgtNie ? null : (
        <div className="order-3 overflow-x-auto rounded-xl border border-border bg-surface lg:col-start-2 lg:row-start-2">
          <table className="w-full min-w-xl text-right text-sm tabular-nums">
            <caption className="border-b border-border px-4 py-3 text-left font-medium">
              Restschuld mit und ohne Sondertilgung
            </caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Jahr</th>
                <th scope="col" className="px-4 py-2 font-medium">ohne</th>
                <th scope="col" className="px-4 py-2 font-medium">mit</th>
                <th scope="col" className="px-4 py-2 font-medium">Unterschied</th>
              </tr>
            </thead>
            <tbody>
              {r.ohne.restschuldProJahr.map((ohne, i) => {
                const mit = r.mit.restschuldProJahr[i];
                const fertig = mit === undefined;
                return (
                  <tr
                    key={i}
                    className={`border-t border-border ${fertig ? "bg-accent-soft" : ""}`}
                  >
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      {i + 1}
                    </th>
                    <td className="px-4 py-2">{formatEuroWhole(ohne)}</td>
                    <td className="px-4 py-2 font-medium">
                      {fertig ? "abbezahlt" : formatEuroWhole(mit)}
                    </td>
                    <td className="px-4 py-2 text-accent">
                      {fertig ? formatEuroWhole(ohne) : formatEuroWhole(ohne - mit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
