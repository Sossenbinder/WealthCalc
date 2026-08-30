"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  berechneAnnuitaetendarlehen,
  TILGT_NIE,
} from "@/lib/engine/finance/annuitaet";

const MAX_MONEY = 100_000_000_00;

interface Fields {
  darlehensbetrag: string;
  sollzins: string;
  anfaenglicheTilgung: string;
  zinsbindungJahre: string;
}

const DEFAULTS = {
  darlehensbetrag: 300_000_00,
  sollzins: 3.5,
  anfaenglicheTilgung: 2,
  zinsbindungJahre: 10,
};

const toFields = (v: typeof DEFAULTS): Fields => ({
  darlehensbetrag: formatMoneyInput(v.darlehensbetrag),
  sollzins: formatNumberInput(v.sollzins),
  anfaenglicheTilgung: formatNumberInput(v.anfaenglicheTilgung),
  zinsbindungJahre: formatNumberInput(v.zinsbindungJahre),
});

const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

export function KreditRechner() {
  const [fields, setFields] = useState<Fields>(() => toFields(DEFAULTS));
  const [urlApplied, setUrlApplied] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if ([...p.keys()].length > 0) {
      const money = (k: string, d: number) => {
        const raw = p.get(k);
        if (raw === null) return d;
        const parsed = parseMoney(raw.replace(".", ","));
        return parsed === null ? d : Math.min(Math.max(parsed, 0), MAX_MONEY);
      };
      const rate = (k: string, d: number, max: number) => {
        const raw = p.get(k);
        if (raw === null) return d;
        const v = Number(raw);
        return Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : d;
      };
      setFields(
        toFields({
          darlehensbetrag: money("b", DEFAULTS.darlehensbetrag),
          sollzins: rate("z", DEFAULTS.sollzins, 25),
          anfaenglicheTilgung: rate("t", DEFAULTS.anfaenglicheTilgung, 50),
          zinsbindungJahre: Math.round(
            rate("f", DEFAULTS.zinsbindungJahre, 40),
          ),
        }),
      );
    }
    setUrlApplied(true);
  }, []);

  const parsed = useMemo(() => {
    const darlehensbetrag = parseMoney(fields.darlehensbetrag);
    const sollzins = parseGermanNumber(fields.sollzins);
    const anfaenglicheTilgung = parseGermanNumber(fields.anfaenglicheTilgung);
    const zinsbindungJahre = parseGermanNumber(fields.zinsbindungJahre);

    const range = {
      darlehensbetrag: outOfRange(darlehensbetrag, 1, MAX_MONEY),
      sollzins: outOfRange(sollzins, 0, 25),
      anfaenglicheTilgung: outOfRange(anfaenglicheTilgung, 0, 50),
      zinsbindungJahre: outOfRange(zinsbindungJahre, 0, 40),
    };

    return {
      input: {
        darlehensbetrag: darlehensbetrag ?? DEFAULTS.darlehensbetrag,
        sollzins: sollzins ?? DEFAULTS.sollzins,
        anfaenglicheTilgung: anfaenglicheTilgung ?? DEFAULTS.anfaenglicheTilgung,
        zinsbindungJahre: Math.round(
          zinsbindungJahre ?? DEFAULTS.zinsbindungJahre,
        ),
      },
      range,
      invalid: {
        darlehensbetrag: darlehensbetrag === null || range.darlehensbetrag,
        sollzins: sollzins === null || range.sollzins,
        anfaenglicheTilgung:
          anfaenglicheTilgung === null || range.anfaenglicheTilgung,
        zinsbindungJahre: zinsbindungJahre === null || range.zinsbindungJahre,
      },
    };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);
  const result = useMemo(
    () => (incomplete ? null : berechneAnnuitaetendarlehen(parsed.input)),
    [incomplete, parsed.input],
  );

  useEffect(() => {
    if (!urlApplied || incomplete) return;
    const p = new URLSearchParams();
    p.set("b", String(parsed.input.darlehensbetrag / 100));
    p.set("z", String(parsed.input.sollzins));
    p.set("t", String(parsed.input.anfaenglicheTilgung));
    p.set("f", String(parsed.input.zinsbindungJahre));
    window.history.replaceState(null, "", `?${p.toString()}`);
  }, [urlApplied, incomplete, parsed.input]);

  const set = (key: keyof Fields) => (value: string) =>
    setFields((c) => ({ ...c, [key]: value }));

  const plan = result && result !== TILGT_NIE ? result : null;

  return (
    <div className="calc-grid">
      <form
        className="card calc-form order-2 flex flex-col gap-4 p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField
          id="darlehensbetrag"
          label="Darlehensbetrag"
          suffix="€"
          value={fields.darlehensbetrag}
          onChange={set("darlehensbetrag")}
          invalid={parsed.invalid.darlehensbetrag}
          error={
            parsed.range.darlehensbetrag
              ? `Zwischen 1 und ${formatMoneyInput(MAX_MONEY)} €.`
              : "Bitte eine Zahl eingeben."
          }
        />
        <NumberField
          id="sollzins"
          label="Sollzins pro Jahr"
          suffix="%"
          value={fields.sollzins}
          onChange={set("sollzins")}
          invalid={parsed.invalid.sollzins}
          hint="Nominaler Zinssatz der Bank."
          error={
            parsed.range.sollzins
              ? "Zwischen 0 und 25 %."
              : "Bitte eine Zahl eingeben."
          }
        />
        <NumberField
          id="anfaenglicheTilgung"
          label="Anfängliche Tilgung"
          suffix="%"
          value={fields.anfaenglicheTilgung}
          onChange={set("anfaenglicheTilgung")}
          invalid={parsed.invalid.anfaenglicheTilgung}
          hint="Üblich sind 2 bis 3 % pro Jahr."
          error={
            parsed.range.anfaenglicheTilgung
              ? "Zwischen 0 und 50 %."
              : "Bitte eine Zahl eingeben."
          }
        />
        <NumberField
          id="zinsbindungJahre"
          label="Zinsbindung"
          suffix="Jahre"
          value={fields.zinsbindungJahre}
          onChange={set("zinsbindungJahre")}
          invalid={parsed.invalid.zinsbindungJahre}
          hint="0 blendet die Restschuld aus."
          error={
            parsed.range.zinsbindungJahre
              ? "Zwischen 0 und 40 Jahren."
              : "Bitte eine Zahl eingeben."
          }
        />
      </form>

      <div data-result-card
        className="card order-1 p-5">
        <p data-result-label className="text-sm font-medium text-muted">Monatliche Rate</p>
        <p data-result-value className="mt-1.5 overflow-x-auto text-4xl sm:text-5xl leading-tight font-semibold tabular-nums tracking-tight">
          {incomplete
            ? "—"
            : result === TILGT_NIE
              ? "Tilgt nie"
              : formatEuro(plan!.monatsrate)}
        </p>

        {incomplete ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : result === TILGT_NIE ? (
          <p className="mt-1 text-sm text-muted">
            Die Rate deckt nicht einmal die Zinsen des ersten Monats — die
            Schuld würde immer weiter wachsen. Erhöhe die anfängliche Tilgung.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {Math.floor(plan!.laufzeitMonate / 12)} Jahre und{" "}
              {plan!.laufzeitMonate % 12} Monate bis zur vollständigen Tilgung
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Gesamtzinsen</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(plan!.gesamtzinsen)}
                </dd>
                <p className="text-xs text-muted">
                  Effektivzins {formatPercent(plan!.effektivzins, 2)}
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Gesamtzahlung</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(plan!.gesamtzahlung)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">
                  {plan!.restschuldBeiZinsbindung === null
                    ? "Restschuld"
                    : `Restschuld nach ${parsed.input.zinsbindungJahre} Jahren`}
                </dt>
                <dd className="text-lg font-medium tabular-nums">
                  {plan!.restschuldBeiZinsbindung === null
                    ? "—"
                    : formatEuro(plan!.restschuldBeiZinsbindung)}
                </dd>
                <p className="text-xs text-muted">
                  {plan!.restschuldBeiZinsbindung === null
                    ? "keine Zinsbindung angegeben"
                    : "muss dann neu finanziert werden"}
                </p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={JSON.stringify(parsed.input)} />
          </>
        )}
      </div>

      {plan ? (
        <div className="card table-scroll order-3">
          <table className="data-table w-full min-w-xl text-right text-sm tabular-nums">
            <caption className="border-b border-border bg-surface px-4 py-3 text-left font-medium">
              Tilgungsplan
            </caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Jahr
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Zinsen
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Tilgung
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Restschuld
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.jahre.map((row) => (
                <tr
                  key={row.jahr}
                  className={`border-t border-border ${
                    row.jahr === parsed.input.zinsbindungJahre
                      ? "bg-accent-soft"
                      : ""
                  }`}
                >
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {row.jahr}
                  </th>
                  <td className="px-4 py-2 text-accent">
                    {formatEuroWhole(row.zinsen)}
                  </td>
                  <td className="px-4 py-2">{formatEuroWhole(row.tilgung)}</td>
                  <td className="px-4 py-2 font-medium">
                    {formatEuroWhole(row.restschuld)}
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
