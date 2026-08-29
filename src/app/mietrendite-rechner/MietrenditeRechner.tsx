"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import {
  formatEuro,
  formatMoneyInput,
  formatNumberInput,
  formatPercent,
  parseGermanNumber,
  parseMoney,
} from "@/lib/engine/format";
import { berechneMietrendite } from "@/lib/engine/finance/mietrendite";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const MONEY = ["kaufpreis", "kaltmieteMonat", "verwaltungMonat", "eigenkapital"] as const;
const RATES = ["kaufnebenkosten", "instandhaltung", "mietausfallwagnis", "sollzins", "anfaenglicheTilgung"] as const;
type Key = (typeof MONEY)[number] | (typeof RATES)[number];

const DEFAULTS: Record<Key, number> = {
  kaufpreis: 300_000_00,
  kaufnebenkosten: 12,
  kaltmieteMonat: 1_000_00,
  verwaltungMonat: 30_00,
  instandhaltung: 1,
  mietausfallwagnis: 2,
  eigenkapital: 80_000_00,
  sollzins: 3.5,
  anfaenglicheTilgung: 2,
};

const LABELS: Record<Key, { label: string; suffix: string; hint?: string }> = {
  kaufpreis: { label: "Kaufpreis", suffix: "€" },
  kaufnebenkosten: {
    label: "Kaufnebenkosten",
    suffix: "%",
    hint: "Grunderwerbsteuer, Notar, Makler — genau im Kaufnebenkosten-Rechner.",
  },
  kaltmieteMonat: { label: "Kaltmiete pro Monat", suffix: "€" },
  verwaltungMonat: {
    label: "Verwaltung pro Monat",
    suffix: "€",
    hint: "Nicht auf die Mieter umlagefähig.",
  },
  instandhaltung: {
    label: "Instandhaltung pro Jahr",
    suffix: "%",
    hint: "Rücklage als Anteil des Kaufpreises, üblich rund 1 %.",
  },
  mietausfallwagnis: {
    label: "Mietausfallwagnis",
    suffix: "%",
    hint: "Anteil der Miete für Leerstand und Ausfälle.",
  },
  eigenkapital: { label: "Eigenkapital", suffix: "€" },
  sollzins: { label: "Sollzins pro Jahr", suffix: "%" },
  anfaenglicheTilgung: { label: "Anfängliche Tilgung", suffix: "%" },
};

const QUERY: Record<Key, string> = {
  kaufpreis: "p", kaufnebenkosten: "nk", kaltmieteMonat: "m",
  verwaltungMonat: "v", instandhaltung: "ih", mietausfallwagnis: "wa",
  eigenkapital: "ek", sollzins: "z", anfaenglicheTilgung: "t",
};

const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

export function MietrenditeRechner() {
  const [fields, setFields] = useState<Record<Key, string>>(() => {
    const out = {} as Record<Key, string>;
    for (const k of Object.keys(DEFAULTS) as Key[]) {
      out[k] = (MONEY as readonly string[]).includes(k)
        ? formatMoneyInput(DEFAULTS[k])
        : formatNumberInput(DEFAULTS[k]);
    }
    return out;
  });
  const set = (k: Key) => (v: string) => setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const values = {} as Record<Key, number>;
    const invalid = {} as Record<Key, boolean>;
    for (const k of MONEY) {
      const v = parseMoney(fields[k]);
      invalid[k] = v === null || outOfRange(v, 0, MAX_MONEY);
      values[k] = v ?? DEFAULTS[k];
    }
    for (const k of RATES) {
      const v = parseGermanNumber(fields[k]);
      invalid[k] = v === null || outOfRange(v, 0, 50);
      values[k] = v ?? DEFAULTS[k];
    }
    return { values, invalid };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (p) => {
      const next = {} as Record<Key, string>;
      for (const k of MONEY) next[k] = formatMoneyInput(readMoney(p, QUERY[k], DEFAULTS[k], MAX_MONEY));
      for (const k of RATES) next[k] = formatNumberInput(readNumber(p, QUERY[k], DEFAULTS[k], 0, 50));
      setFields(next);
    },
    () => {
      const p = new URLSearchParams();
      for (const k of MONEY) p.set(QUERY[k], moneyParam(parsed.values[k]));
      for (const k of RATES) p.set(QUERY[k], numberParam(parsed.values[k]));
      return p;
    },
    !incomplete,
    JSON.stringify(parsed.values),
  );

  const r = useMemo(
    () => (incomplete ? null : berechneMietrendite(parsed.values)),
    [incomplete, parsed.values],
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        {(Object.keys(LABELS) as Key[]).map((k) => (
          <NumberField
            key={k}
            id={k}
            label={LABELS[k].label}
            suffix={LABELS[k].suffix}
            hint={LABELS[k].hint}
            value={fields[k]}
            onChange={set(k)}
            invalid={parsed.invalid[k]}
            error="Bitte einen gültigen Wert eingeben."
          />
        ))}
      </form>

      <div className="order-1 rounded-xl border border-border bg-surface p-5 lg:col-start-2 lg:row-start-1">
        <p className="text-sm text-muted">Nettomietrendite</p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatPercent(r.nettomietrendite, 2)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              die Bruttomietrendite aus dem Exposé wäre{" "}
              {formatPercent(r.bruttomietrendite, 2)} — sie rechnet weder
              Nebenkosten noch laufende Kosten mit
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Cashflow pro Monat</dt>
                <dd
                  className={`text-lg font-medium tabular-nums ${
                    r.cashflowMonat >= 0 ? "text-accent" : "text-error"
                  }`}
                >
                  {formatEuro(r.cashflowMonat)}
                </dd>
                <p className="text-xs text-muted">
                  {r.nichtFinanzierbar
                    ? "Darlehen tilgt nie — Tilgung erhöhen"
                    : `nach ${formatEuro(r.nichtUmlagefaehigMonat)} Kosten und ${formatEuro(r.monatsrate)} Rate`}
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Gesamtinvestition</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.gesamtinvestition)}
                </dd>
                <p className="text-xs text-muted">
                  davon {formatEuro(r.nebenkosten)} Nebenkosten
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Kaufpreisfaktor</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatNumberInput(Math.round(r.kaufpreisfaktor * 10) / 10)}
                </dd>
                <p className="text-xs text-muted">Jahresmieten für den Kaufpreis</p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={JSON.stringify(parsed.values)} />
          </>
        )}
      </div>

      {r === null ? null : (
        <div className="order-3 overflow-x-auto rounded-xl border border-border bg-surface lg:col-start-2 lg:row-start-2">
          <table className="w-full text-right text-sm tabular-nums">
            <caption className="border-b border-border px-4 py-3 text-left font-medium">
              Monatliche Rechnung
            </caption>
            <tbody>
              {[
                ["Kaltmiete", parsed.values.kaltmieteMonat],
                ["abzüglich nicht umlagefähiger Kosten", -r.nichtUmlagefaehigMonat || 0],
                ["abzüglich Darlehensrate", -r.monatsrate || 0],
                ["Cashflow", r.cashflowMonat],
              ].map(([label, value], i, all) => (
                <tr
                  key={label as string}
                  className={`border-t border-border ${
                    i === all.length - 1 ? "font-medium" : ""
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
          <p className="border-t border-border px-4 py-3 text-xs text-muted">
            Vor Steuern. Abschreibung, Werbungskosten und die Besteuerung der
            Mieteinnahmen sind hier nicht abgebildet.
          </p>
        </div>
      )}
    </div>
  );
}
