"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import {
  formatEuro,
  formatMoneyInput,
  formatNumberInput,
  parseGermanNumber,
  parseMoney,
} from "@/lib/engine/format";
import { vergleicheLeasingKauf } from "@/lib/engine/finance/leasing-kauf";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const MONEY = ["listenpreis", "leasingSonderzahlung", "leasingRate", "kaufAnzahlung"] as const;
const RATES = ["kaufSollzins", "wertverlustProJahr", "kapitalrendite"] as const;
type Key = (typeof MONEY)[number] | (typeof RATES)[number] | "laufzeitMonate";

const DEFAULTS: Record<Key, number> = {
  listenpreis: 40_000_00,
  laufzeitMonate: 48,
  leasingSonderzahlung: 4_000_00,
  leasingRate: 350_00,
  kaufAnzahlung: 4_000_00,
  kaufSollzins: 5,
  wertverlustProJahr: 15,
  kapitalrendite: 4,
};

const LABELS: Record<Key, { label: string; suffix: string; hint?: string }> = {
  listenpreis: { label: "Listenpreis", suffix: "€" },
  laufzeitMonate: { label: "Laufzeit", suffix: "Monate", hint: "Für beide Wege gleich." },
  leasingSonderzahlung: { label: "Leasing-Sonderzahlung", suffix: "€" },
  leasingRate: { label: "Leasingrate pro Monat", suffix: "€" },
  kaufAnzahlung: { label: "Anzahlung beim Kauf", suffix: "€" },
  kaufSollzins: { label: "Sollzins der Finanzierung", suffix: "%" },
  wertverlustProJahr: {
    label: "Wertverlust pro Jahr",
    suffix: "%",
    hint: "Neuwagen verlieren im ersten Jahr am meisten.",
  },
  kapitalrendite: {
    label: "Rendite auf freies Kapital",
    suffix: "%",
    hint: "Was das nicht gebundene Geld erwirtschaftet.",
  },
};

const QUERY: Record<Key, string> = {
  listenpreis: "p", laufzeitMonate: "n", leasingSonderzahlung: "ls",
  leasingRate: "lr", kaufAnzahlung: "ka", kaufSollzins: "z",
  wertverlustProJahr: "w", kapitalrendite: "r",
};

const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

export function LeasingKaufRechner() {
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
    const n = parseGermanNumber(fields.laufzeitMonate);
    invalid.laufzeitMonate = n === null || outOfRange(n, 1, 120);
    values.laufzeitMonate = Math.round(n ?? DEFAULTS.laufzeitMonate);
    return { values, invalid };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (p) => {
      const next = {} as Record<Key, string>;
      for (const k of MONEY) next[k] = formatMoneyInput(readMoney(p, QUERY[k], DEFAULTS[k], MAX_MONEY));
      for (const k of RATES) next[k] = formatNumberInput(readNumber(p, QUERY[k], DEFAULTS[k], 0, 50));
      next.laufzeitMonate = formatNumberInput(
        Math.round(readNumber(p, QUERY.laufzeitMonate, DEFAULTS.laufzeitMonate, 1, 120)),
      );
      setFields(next);
    },
    () => {
      const p = new URLSearchParams();
      for (const k of MONEY) p.set(QUERY[k], moneyParam(parsed.values[k]));
      for (const k of RATES) p.set(QUERY[k], numberParam(parsed.values[k]));
      p.set(QUERY.laufzeitMonate, numberParam(parsed.values.laufzeitMonate));
      return p;
    },
    !incomplete,
    JSON.stringify(parsed.values),
  );

  const r = useMemo(
    () => (incomplete ? null : vergleicheLeasingKauf(parsed.values)),
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
        <p className="text-sm text-muted">
          Über {parsed.values.laufzeitMonate} Monate günstiger
        </p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : r.leasingGuenstiger ? "Leasing" : "Kaufen"}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              Vorsprung {formatEuro(Math.abs(r.differenz))} — der Kauf endet mit
              einem Auto, das noch {formatEuro(r.restwert)} wert ist
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Leasing kostet</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.leasingEffektiv)}
                </dd>
                <p className="text-xs text-muted">
                  {formatEuro(r.leasingGesamt)} Zahlungen, danach ist das Auto weg
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Kauf kostet</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(r.kaufEffektiv)}
                </dd>
                <p className="text-xs text-muted">
                  {formatEuro(r.kaufRate)} im Monat, abzüglich Restwert
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Zinsen der Finanzierung</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.kaufZinsen)}
                </dd>
                <p className="text-xs text-muted">
                  auf {formatEuro(r.kaufDarlehen)} Darlehen
                </p>
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
              Gegenüberstellung
            </caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Position</th>
                <th scope="col" className="px-4 py-2 font-medium">Leasing</th>
                <th scope="col" className="px-4 py-2 font-medium">Kauf</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Zu Beginn", parsed.values.leasingSonderzahlung, parsed.values.kaufAnzahlung],
                ["Pro Monat", parsed.values.leasingRate, r.kaufRate],
                ["Summe der Zahlungen", r.leasingGesamt, parsed.values.kaufAnzahlung + r.kaufRate * parsed.values.laufzeitMonate],
                ["Auto am Ende wert", 0, r.restwert],
                ["Zwischensumme", r.leasingGesamt, r.kaufGesamt],
                [
                  "Rendite auf freies Kapital",
                  r.zinsvorteil > 0 ? -r.zinsvorteil : 0,
                  r.zinsvorteil < 0 ? r.zinsvorteil : 0,
                ],
                ["Kosten unterm Strich", r.leasingEffektiv, r.kaufEffektiv],
              ].map(([label, l, k], i, all) => (
                <tr
                  key={label as string}
                  className={`border-t border-border ${i === all.length - 1 ? "font-medium" : ""}`}
                >
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {label as string}
                  </th>
                  <td className="px-4 py-2">{formatEuro(l as number)}</td>
                  <td className="px-4 py-2">{formatEuro(k as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-3 text-xs text-muted">
            Ohne Wartung, Versicherung und Kilometerbegrenzung — die
            unterscheiden sich zwischen beiden Wegen und hängen vom Vertrag ab.
            Die Rendite auf nicht gebundenes Kapital ist eingerechnet.
          </p>
        </div>
      )}
    </div>
  );
}
