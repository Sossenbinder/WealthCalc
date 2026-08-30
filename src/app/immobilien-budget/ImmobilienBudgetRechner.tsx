"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import { SelectField } from "@/components/SelectField";
import {
  formatEuro,
  formatMoneyInput,
  formatNumberInput,
  formatPercent,
  parseGermanNumber,
  parseMoney,
} from "@/lib/engine/format";
import { berechneImmobilienBudget } from "@/lib/engine/finance/budget-immobilie";
import { TILGT_NIE } from "@/lib/engine/finance/annuitaet";
import {
  BUNDESLAENDER,
  grunderwerbsteuerSatz,
} from "@/lib/engine/tax/grunderwerbsteuer";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULTS = {
  monatsrate: 1_500_00,
  eigenkapital: 100_000_00,
  sollzins: 3.5,
  anfaenglicheTilgung: 2,
  notarUndGrundbuch: 2,
  maklerprovision: 3.57,
};
const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

export function ImmobilienBudgetRechner() {
  const [land, setLand] = useState("nw");
  const [fields, setFields] = useState({
    monatsrate: formatMoneyInput(DEFAULTS.monatsrate),
    eigenkapital: formatMoneyInput(DEFAULTS.eigenkapital),
    sollzins: formatNumberInput(DEFAULTS.sollzins),
    anfaenglicheTilgung: formatNumberInput(DEFAULTS.anfaenglicheTilgung),
    notarUndGrundbuch: formatNumberInput(DEFAULTS.notarUndGrundbuch),
    maklerprovision: formatNumberInput(DEFAULTS.maklerprovision),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const monatsrate = parseMoney(fields.monatsrate);
    const eigenkapital = parseMoney(fields.eigenkapital);
    const sollzins = parseGermanNumber(fields.sollzins);
    const anfaenglicheTilgung = parseGermanNumber(fields.anfaenglicheTilgung);
    const notarUndGrundbuch = parseGermanNumber(fields.notarUndGrundbuch);
    const maklerprovision = parseGermanNumber(fields.maklerprovision);
    const range = {
      monatsrate: outOfRange(monatsrate, 1, MAX_MONEY),
      eigenkapital: outOfRange(eigenkapital, 0, MAX_MONEY),
      sollzins: outOfRange(sollzins, 0, 25),
      anfaenglicheTilgung: outOfRange(anfaenglicheTilgung, 0, 50),
      notarUndGrundbuch: outOfRange(notarUndGrundbuch, 0, 20),
      maklerprovision: outOfRange(maklerprovision, 0, 20),
    };
    return {
      values: {
        monatsrate: monatsrate ?? DEFAULTS.monatsrate,
        eigenkapital: eigenkapital ?? DEFAULTS.eigenkapital,
        sollzins: sollzins ?? DEFAULTS.sollzins,
        anfaenglicheTilgung: anfaenglicheTilgung ?? DEFAULTS.anfaenglicheTilgung,
        notarUndGrundbuch: notarUndGrundbuch ?? DEFAULTS.notarUndGrundbuch,
        maklerprovision: maklerprovision ?? DEFAULTS.maklerprovision,
      },
      range,
      invalid: Object.fromEntries(
        Object.entries({
          monatsrate: monatsrate === null || range.monatsrate,
          eigenkapital: eigenkapital === null || range.eigenkapital,
          sollzins: sollzins === null || range.sollzins,
          anfaenglicheTilgung: anfaenglicheTilgung === null || range.anfaenglicheTilgung,
          notarUndGrundbuch: notarUndGrundbuch === null || range.notarUndGrundbuch,
          maklerprovision: maklerprovision === null || range.maklerprovision,
        }),
      ) as Record<keyof typeof fields, boolean>,
    };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);
  const satz = grunderwerbsteuerSatz(land) ?? 0;

  useScenarioUrl(
    (p) => {
      const l = p.get("l");
      if (l && grunderwerbsteuerSatz(l) !== null) setLand(l);
      setFields({
        monatsrate: formatMoneyInput(readMoney(p, "r", DEFAULTS.monatsrate, MAX_MONEY)),
        eigenkapital: formatMoneyInput(readMoney(p, "ek", DEFAULTS.eigenkapital, MAX_MONEY)),
        sollzins: formatNumberInput(readNumber(p, "z", DEFAULTS.sollzins, 0, 25)),
        anfaenglicheTilgung: formatNumberInput(readNumber(p, "t", DEFAULTS.anfaenglicheTilgung, 0, 50)),
        notarUndGrundbuch: formatNumberInput(readNumber(p, "n", DEFAULTS.notarUndGrundbuch, 0, 20)),
        maklerprovision: formatNumberInput(readNumber(p, "m", DEFAULTS.maklerprovision, 0, 20)),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("r", moneyParam(parsed.values.monatsrate));
      p.set("ek", moneyParam(parsed.values.eigenkapital));
      p.set("z", numberParam(parsed.values.sollzins));
      p.set("t", numberParam(parsed.values.anfaenglicheTilgung));
      p.set("n", numberParam(parsed.values.notarUndGrundbuch));
      p.set("m", numberParam(parsed.values.maklerprovision));
      p.set("l", land);
      return p;
    },
    !incomplete,
    `${land}|${JSON.stringify(parsed.values)}`,
  );

  const result = useMemo(
    () =>
      incomplete
        ? null
        : berechneImmobilienBudget({ ...parsed.values, grunderwerbsteuer: satz }),
    [incomplete, parsed.values, satz],
  );
  const r = result && result !== TILGT_NIE ? result : null;

  return (
    <div className="calc-grid">
      <form
        className="card calc-form order-2 flex flex-col gap-4 p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField id="monatsrate" label="Monatliche Rate" suffix="€"
          value={fields.monatsrate} onChange={set("monatsrate")}
          invalid={parsed.invalid.monatsrate}
          hint="Was dauerhaft für Zins und Tilgung übrig ist."
          error="Bitte eine Zahl eingeben." />
        <NumberField id="eigenkapital" label="Eigenkapital" suffix="€"
          value={fields.eigenkapital} onChange={set("eigenkapital")}
          invalid={parsed.invalid.eigenkapital} error="Bitte eine Zahl eingeben." />
        <NumberField id="sollzins" label="Sollzins pro Jahr" suffix="%"
          value={fields.sollzins} onChange={set("sollzins")}
          invalid={parsed.invalid.sollzins}
          error={parsed.range.sollzins ? "Zwischen 0 und 25 %." : "Bitte eine Zahl eingeben."} />
        <NumberField id="anfaenglicheTilgung" label="Anfängliche Tilgung" suffix="%"
          value={fields.anfaenglicheTilgung} onChange={set("anfaenglicheTilgung")}
          invalid={parsed.invalid.anfaenglicheTilgung}
          error={parsed.range.anfaenglicheTilgung ? "Zwischen 0 und 50 %." : "Bitte eine Zahl eingeben."} />
        <SelectField id="land" label="Bundesland" value={land} onChange={setLand}
          options={BUNDESLAENDER.map((l) => ({ value: l.id, label: `${l.name} — ${formatNumberInput(l.satz)} %` }))}
          hint={`Grunderwerbsteuer ${formatPercent(satz, 1)}.`} />
        <NumberField id="notarUndGrundbuch" label="Notar und Grundbuch" suffix="%"
          value={fields.notarUndGrundbuch} onChange={set("notarUndGrundbuch")}
          invalid={parsed.invalid.notarUndGrundbuch}
          error={parsed.range.notarUndGrundbuch ? "Zwischen 0 und 20 %." : "Bitte eine Zahl eingeben."} />
        <NumberField id="maklerprovision" label="Maklerprovision" suffix="%"
          value={fields.maklerprovision} onChange={set("maklerprovision")}
          invalid={parsed.invalid.maklerprovision}
          hint="0, wenn ohne Makler."
          error={parsed.range.maklerprovision ? "Zwischen 0 und 20 %." : "Bitte eine Zahl eingeben."} />
      </form>

      <div data-result-card
        className="card order-1 p-5">
        <p data-result-label className="text-sm font-medium text-muted">Die Immobilie darf kosten</p>
        <p data-result-value className="mt-1.5 overflow-x-auto text-4xl sm:text-5xl leading-tight font-semibold tabular-nums tracking-tight">
          {incomplete ? "—" : result === TILGT_NIE ? "Nicht finanzierbar" : formatEuro(r!.maxKaufpreis)}
        </p>
        {incomplete ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : result === TILGT_NIE ? (
          <p className="mt-1 text-sm text-muted">
            Ohne Zins und Tilgung lässt sich kein Darlehen berechnen.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {r!.eigenkapitalReichtNicht
                ? `dein Eigenkapital deckt die Nebenkosten von ${formatEuro(r!.nebenkosten)} nicht`
                : `davon ${formatEuro(r!.darlehen)} Darlehen und ${formatEuro(r!.eigenkapitalFuerKaufpreis)} Eigenkapital`}
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Kaufnebenkosten</dt>
                <dd className={`text-lg font-medium tabular-nums ${r!.eigenkapitalReichtNicht ? "text-error" : ""}`}>
                  {formatEuro(r!.nebenkosten)}
                </dd>
                <p className="text-xs text-muted">
                  {formatPercent(r!.nebenkostenAnteil, 2)} — vom Eigenkapital zu zahlen
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Darlehen</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(r!.darlehen)}
                </dd>
                <p className="text-xs text-muted">
                  {Math.floor(r!.laufzeitMonate / 12)} Jahre bis zur Tilgung
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Zinsen insgesamt</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r!.gesamtzinsen)}
                </dd>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={`${land}|${JSON.stringify(parsed.values)}`} />
          </>
        )}
      </div>

      {r === null ? null : (
        <div className="card table-scroll order-3">
          <table className="data-table w-full text-right text-sm tabular-nums">
            <caption className="border-b border-border bg-surface px-4 py-3 text-left font-medium">
              Wie sich das Budget zusammensetzt
            </caption>
            <tbody>
              {[
                ["Monatliche Rate", parsed.values.monatsrate],
                ["Daraus tragbares Darlehen", r.darlehen],
                ["Eigenkapital", parsed.values.eigenkapital],
                ["abzüglich Kaufnebenkosten", -r.nebenkosten || 0],
                ["Maximaler Kaufpreis", r.maxKaufpreis],
              ].map(([label, value], i, all) => (
                <tr key={label as string} className={`border-t border-border ${i === all.length - 1 ? "font-medium" : ""}`}>
                  <th scope="row" className="px-4 py-2 text-left font-normal">{label as string}</th>
                  <td className="px-4 py-2">{formatEuro(value as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
