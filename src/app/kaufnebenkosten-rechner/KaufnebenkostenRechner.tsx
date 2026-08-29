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
import { berechneKaufnebenkosten } from "@/lib/engine/finance/kaufnebenkosten";
import {
  BUNDESLAENDER,
  GRUNDERWERBSTEUER_STAND,
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
  kaufpreis: 400_000_00,
  notarUndGrundbuch: 2,
  maklerprovision: 3.57,
  eigenkapital: 100_000_00,
};
const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

export function KaufnebenkostenRechner() {
  const [land, setLand] = useState("nw");
  const [fields, setFields] = useState({
    kaufpreis: formatMoneyInput(DEFAULTS.kaufpreis),
    notarUndGrundbuch: formatNumberInput(DEFAULTS.notarUndGrundbuch),
    maklerprovision: formatNumberInput(DEFAULTS.maklerprovision),
    eigenkapital: formatMoneyInput(DEFAULTS.eigenkapital),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const kaufpreis = parseMoney(fields.kaufpreis);
    const eigenkapital = parseMoney(fields.eigenkapital);
    const notarUndGrundbuch = parseGermanNumber(fields.notarUndGrundbuch);
    const maklerprovision = parseGermanNumber(fields.maklerprovision);
    const range = {
      kaufpreis: outOfRange(kaufpreis, 0, MAX_MONEY),
      eigenkapital: outOfRange(eigenkapital, 0, MAX_MONEY),
      notarUndGrundbuch: outOfRange(notarUndGrundbuch, 0, 20),
      maklerprovision: outOfRange(maklerprovision, 0, 20),
    };
    return {
      values: {
        kaufpreis: kaufpreis ?? DEFAULTS.kaufpreis,
        eigenkapital: eigenkapital ?? DEFAULTS.eigenkapital,
        notarUndGrundbuch: notarUndGrundbuch ?? DEFAULTS.notarUndGrundbuch,
        maklerprovision: maklerprovision ?? DEFAULTS.maklerprovision,
      },
      range,
      invalid: {
        kaufpreis: kaufpreis === null || range.kaufpreis,
        eigenkapital: eigenkapital === null || range.eigenkapital,
        notarUndGrundbuch:
          notarUndGrundbuch === null || range.notarUndGrundbuch,
        maklerprovision: maklerprovision === null || range.maklerprovision,
      },
    };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);
  const satz = grunderwerbsteuerSatz(land) ?? 0;

  useScenarioUrl(
    (p) => {
      const l = p.get("l");
      if (l && grunderwerbsteuerSatz(l) !== null) setLand(l);
      setFields({
        kaufpreis: formatMoneyInput(readMoney(p, "p", DEFAULTS.kaufpreis, MAX_MONEY)),
        eigenkapital: formatMoneyInput(readMoney(p, "ek", DEFAULTS.eigenkapital, MAX_MONEY)),
        notarUndGrundbuch: formatNumberInput(
          readNumber(p, "n", DEFAULTS.notarUndGrundbuch, 0, 20),
        ),
        maklerprovision: formatNumberInput(
          readNumber(p, "m", DEFAULTS.maklerprovision, 0, 20),
        ),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("p", moneyParam(parsed.values.kaufpreis));
      p.set("ek", moneyParam(parsed.values.eigenkapital));
      p.set("n", numberParam(parsed.values.notarUndGrundbuch));
      p.set("m", numberParam(parsed.values.maklerprovision));
      p.set("l", land);
      return p;
    },
    !incomplete,
    `${land}|${JSON.stringify(parsed.values)}`,
  );

  const r = useMemo(
    () =>
      incomplete
        ? null
        : berechneKaufnebenkosten({
            ...parsed.values,
            grunderwerbsteuerSatz: satz,
          }),
    [incomplete, parsed.values, satz],
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField
          id="kaufpreis"
          label="Kaufpreis"
          suffix="€"
          value={fields.kaufpreis}
          onChange={set("kaufpreis")}
          invalid={parsed.invalid.kaufpreis}
          error="Bitte eine Zahl eingeben."
        />
        <SelectField
          id="land"
          label="Bundesland"
          value={land}
          onChange={setLand}
          options={BUNDESLAENDER.map((l) => ({
            value: l.id,
            label: `${l.name} — ${formatNumberInput(l.satz)} %`,
          }))}
          hint={`Grunderwerbsteuer ${formatPercent(satz, 1)}, Stand ${GRUNDERWERBSTEUER_STAND}.`}
        />
        <NumberField
          id="notarUndGrundbuch"
          label="Notar und Grundbuch"
          suffix="%"
          value={fields.notarUndGrundbuch}
          onChange={set("notarUndGrundbuch")}
          invalid={parsed.invalid.notarUndGrundbuch}
          hint="Üblich rund 1,5 bis 2 % — keine feste Größe."
          error={
            parsed.range.notarUndGrundbuch
              ? "Zwischen 0 und 20 %."
              : "Bitte eine Zahl eingeben."
          }
        />
        <NumberField
          id="maklerprovision"
          label="Maklerprovision"
          suffix="%"
          value={fields.maklerprovision}
          onChange={set("maklerprovision")}
          invalid={parsed.invalid.maklerprovision}
          hint="Dein Anteil inkl. MwSt.; 0, wenn ohne Makler."
          error={
            parsed.range.maklerprovision
              ? "Zwischen 0 und 20 %."
              : "Bitte eine Zahl eingeben."
          }
        />
        <NumberField
          id="eigenkapital"
          label="Eigenkapital"
          suffix="€"
          value={fields.eigenkapital}
          onChange={set("eigenkapital")}
          invalid={parsed.invalid.eigenkapital}
          error="Bitte eine Zahl eingeben."
        />
      </form>

      <div className="order-1 rounded-xl border border-border bg-surface p-5 lg:col-start-2 lg:row-start-1">
        <p className="text-sm text-muted">Nebenkosten</p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatEuro(r.nebenkostenGesamt)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {formatPercent(r.nebenkostenAnteil, 2)} des Kaufpreises — der Kauf
              kostet insgesamt {formatEuro(r.gesamtkosten)}
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Eigenkapital danach</dt>
                <dd
                  className={`text-lg font-medium tabular-nums ${
                    r.eigenkapitalReichtNicht ? "text-error" : ""
                  }`}
                >
                  {formatEuro(r.eigenkapitalNachNebenkosten)}
                </dd>
                <p className="text-xs text-muted">
                  {r.eigenkapitalReichtNicht
                    ? "reicht nicht für die Nebenkosten"
                    : "bleibt als Anzahlung übrig"}
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Finanzierungsbedarf</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(r.finanzierungsbedarf)}
                </dd>
                <p className="text-xs text-muted">
                  Banken finanzieren die Nebenkosten meist nicht mit
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Grunderwerbsteuer</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.grunderwerbsteuer)}
                </dd>
                <p className="text-xs text-muted">
                  {BUNDESLAENDER.find((l) => l.id === land)?.name}
                </p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={`${land}|${JSON.stringify(parsed.values)}`} />
          </>
        )}
      </div>

      {r === null ? null : (
        <div className="order-3 overflow-x-auto rounded-xl border border-border bg-surface lg:col-start-2 lg:row-start-2">
          <table className="w-full text-right text-sm tabular-nums">
            <caption className="border-b border-border px-4 py-3 text-left font-medium">
              Aufstellung
            </caption>
            <tbody>
              {[
                ["Kaufpreis", parsed.values.kaufpreis],
                [`Grunderwerbsteuer (${formatNumberInput(satz)} %)`, r.grunderwerbsteuer],
                [
                  `Notar und Grundbuch (${formatNumberInput(parsed.values.notarUndGrundbuch)} %)`,
                  r.notarUndGrundbuch,
                ],
                [
                  `Maklerprovision (${formatNumberInput(parsed.values.maklerprovision)} %)`,
                  r.maklerprovision,
                ],
                ["Nebenkosten gesamt", r.nebenkostenGesamt],
                ["Gesamtkosten", r.gesamtkosten],
              ].map(([label, value], i, all) => (
                <tr
                  key={label as string}
                  className={`border-t border-border ${
                    i >= all.length - 2 ? "font-medium" : ""
                  }`}
                >
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {label as string}
                  </th>
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
