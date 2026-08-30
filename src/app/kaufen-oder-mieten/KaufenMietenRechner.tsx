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
  vergleicheKaufenMieten,
  KAUF_UNFINANZIERBAR,
} from "@/lib/engine/finance/kaufen-mieten";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

const MONEY_FIELDS = ["kaufpreis", "eigenkapital", "kaltmiete"] as const;
const RATE_FIELDS = [
  "kaufnebenkosten",
  "sollzins",
  "anfaenglicheTilgung",
  "instandhaltung",
  "wertsteigerung",
  "mietsteigerung",
  "kapitalrendite",
] as const;

type MoneyKey = (typeof MONEY_FIELDS)[number];
type RateKey = (typeof RATE_FIELDS)[number];
type FieldKey = MoneyKey | RateKey | "jahre";

const LABELS: Record<FieldKey, { label: string; suffix: string; hint?: string }> = {
  kaufpreis: { label: "Kaufpreis", suffix: "€" },
  kaufnebenkosten: {
    label: "Kaufnebenkosten",
    suffix: "%",
    hint: "Grunderwerbsteuer, Notar, Makler — meist 9 bis 12 %.",
  },
  eigenkapital: { label: "Eigenkapital", suffix: "€" },
  sollzins: { label: "Sollzins pro Jahr", suffix: "%" },
  anfaenglicheTilgung: { label: "Anfängliche Tilgung", suffix: "%" },
  instandhaltung: {
    label: "Instandhaltung pro Jahr",
    suffix: "%",
    hint: "Anteil des Kaufpreises, üblich rund 1 %.",
  },
  wertsteigerung: { label: "Wertsteigerung pro Jahr", suffix: "%" },
  kaltmiete: { label: "Kaltmiete pro Monat", suffix: "€" },
  mietsteigerung: { label: "Mietsteigerung pro Jahr", suffix: "%" },
  kapitalrendite: {
    label: "Rendite auf Angelegtes",
    suffix: "%",
    hint: "Was die Mietpartei mit dem nicht gebundenen Kapital erzielt.",
  },
  jahre: { label: "Zeitraum", suffix: "Jahre" },
};

/** Short query keys, so a shared link stays paste-able. */
const QUERY_KEYS: Record<FieldKey, string> = {
  kaufpreis: "kp",
  kaufnebenkosten: "nk",
  eigenkapital: "ek",
  sollzins: "sz",
  anfaenglicheTilgung: "ti",
  instandhaltung: "ih",
  wertsteigerung: "ws",
  kaltmiete: "km",
  mietsteigerung: "ms",
  kapitalrendite: "kr",
  jahre: "jr",
};

const DEFAULTS: Record<FieldKey, number> = {
  kaufpreis: 400_000_00,
  kaufnebenkosten: 10,
  eigenkapital: 100_000_00,
  sollzins: 3.5,
  anfaenglicheTilgung: 2,
  instandhaltung: 1,
  wertsteigerung: 2,
  kaltmiete: 1_200_00,
  mietsteigerung: 2,
  kapitalrendite: 6,
  jahre: 30,
};

export function KaufenMietenRechner() {
  const [fields, setFields] = useState<Record<FieldKey, string>>(() => {
    const out = {} as Record<FieldKey, string>;
    for (const k of Object.keys(DEFAULTS) as FieldKey[]) {
      out[k] = (MONEY_FIELDS as readonly string[]).includes(k)
        ? formatMoneyInput(DEFAULTS[k])
        : formatNumberInput(DEFAULTS[k]);
    }
    return out;
  });
  const set = (k: FieldKey) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const values = {} as Record<FieldKey, number>;
    const invalid = {} as Record<FieldKey, boolean>;

    for (const k of MONEY_FIELDS) {
      const v = parseMoney(fields[k]);
      invalid[k] = v === null || outOfRange(v, 0, MAX_MONEY);
      values[k] = v ?? DEFAULTS[k];
    }
    for (const k of RATE_FIELDS) {
      const v = parseGermanNumber(fields[k]);
      invalid[k] = v === null || outOfRange(v, -50, 100);
      values[k] = v ?? DEFAULTS[k];
    }
    const jahre = parseGermanNumber(fields.jahre);
    invalid.jahre = jahre === null || outOfRange(jahre, 1, 60);
    values.jahre = Math.round(jahre ?? DEFAULTS.jahre);

    return { values, invalid };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (params) => {
      const next = {} as Record<FieldKey, string>;
      for (const k of MONEY_FIELDS) {
        next[k] = formatMoneyInput(
          readMoney(params, QUERY_KEYS[k], DEFAULTS[k], MAX_MONEY),
        );
      }
      for (const k of RATE_FIELDS) {
        next[k] = formatNumberInput(
          readNumber(params, QUERY_KEYS[k], DEFAULTS[k], -50, 100),
        );
      }
      next.jahre = formatNumberInput(
        Math.round(readNumber(params, QUERY_KEYS.jahre, DEFAULTS.jahre, 1, 60)),
      );
      setFields(next);
    },
    () => {
      const p = new URLSearchParams();
      for (const k of MONEY_FIELDS) {
        p.set(QUERY_KEYS[k], moneyParam(parsed.values[k]));
      }
      for (const k of RATE_FIELDS) {
        p.set(QUERY_KEYS[k], numberParam(parsed.values[k]));
      }
      p.set(QUERY_KEYS.jahre, numberParam(parsed.values.jahre));
      return p;
    },
    !incomplete,
    JSON.stringify(parsed.values),
  );

  const result = useMemo(
    () => (incomplete ? null : vergleicheKaufenMieten(parsed.values)),
    [incomplete, parsed.values],
  );
  const plan = result && result !== KAUF_UNFINANZIERBAR ? result : null;
  const kaufFuehrt = plan ? plan.vermoegenKaufEnde >= plan.vermoegenMieteEnde : false;

  return (
    <div className="calc-grid">
      <form
        className="card calc-form order-2 flex flex-col gap-4 p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        {(Object.keys(LABELS) as FieldKey[]).map((k) => (
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

      <div data-result-card
        className="card order-1 p-5">
        <p data-result-label className="text-sm font-medium text-muted">
          Nach {parsed.values.jahre} Jahren lohnt sich
        </p>
        <p data-result-value className="mt-1.5 overflow-x-auto text-4xl sm:text-5xl leading-tight font-semibold tabular-nums tracking-tight">
          {incomplete
            ? "—"
            : result === KAUF_UNFINANZIERBAR
              ? "Nicht finanzierbar"
              : kaufFuehrt
                ? "Kaufen"
                : "Mieten"}
        </p>

        {incomplete ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : result === KAUF_UNFINANZIERBAR ? (
          <p className="mt-1 text-sm text-muted">
            Die Rate deckt nicht einmal die Zinsen — mit dieser Tilgung käme
            kein Darlehen zustande.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              Vorsprung{" "}
              {formatEuro(
                Math.abs(plan!.vermoegenKaufEnde - plan!.vermoegenMieteEnde),
              )}
              {plan!.breakEvenJahr === null
                ? " — Kaufen holt den Rückstand im Zeitraum nicht auf"
                : ` — Kaufen zieht in Jahr ${plan!.breakEvenJahr} vorbei`}
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Vermögen mit Kaufen</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(plan!.vermoegenKaufEnde)}
                </dd>
                <p className="text-xs text-muted">
                  Immobilie abzüglich Restschuld
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Vermögen mit Mieten</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(plan!.vermoegenMieteEnde)}
                </dd>
                <p className="text-xs text-muted">
                  angelegtes Eigenkapital und Differenz
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Darlehen</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(plan!.darlehen)}
                </dd>
                <p className="text-xs text-muted">
                  {formatEuro(plan!.monatsrate)} pro Monat, dazu{" "}
                  {formatEuro(plan!.nebenkosten)} Nebenkosten
                </p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={JSON.stringify(parsed.values)} />
          </>
        )}
      </div>

      {plan ? (
        <div className="card table-scroll order-3">
          <table className="data-table w-full min-w-xl text-right text-sm tabular-nums">
            <caption className="border-b border-border bg-surface px-4 py-3 text-left font-medium">
              Vermögen Jahr für Jahr
            </caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Jahr</th>
                <th scope="col" className="px-4 py-2 font-medium">Wohnkosten Kauf</th>
                <th scope="col" className="px-4 py-2 font-medium">Miete</th>
                <th scope="col" className="px-4 py-2 font-medium">Restschuld</th>
                <th scope="col" className="px-4 py-2 font-medium">Vermögen Kauf</th>
                <th scope="col" className="px-4 py-2 font-medium">Vermögen Miete</th>
              </tr>
            </thead>
            <tbody>
              {plan.jahre.map((row) => (
                <tr
                  key={row.jahr}
                  className={`border-t border-border ${
                    row.jahr === plan.breakEvenJahr ? "bg-accent-soft" : ""
                  }`}
                >
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {row.jahr}
                  </th>
                  <td className="px-4 py-2">{formatEuroWhole(row.wohnkostenKauf)}</td>
                  <td className="px-4 py-2">{formatEuroWhole(row.wohnkostenMiete)}</td>
                  <td className="px-4 py-2 text-muted">
                    {formatEuroWhole(row.restschuld)}
                  </td>
                  <td className="px-4 py-2 font-medium">
                    {formatEuroWhole(row.vermoegenKauf)}
                  </td>
                  <td className="px-4 py-2 font-medium text-accent">
                    {formatEuroWhole(row.vermoegenMiete)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
