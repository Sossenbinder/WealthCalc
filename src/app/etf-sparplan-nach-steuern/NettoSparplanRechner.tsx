"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import { SelectField } from "@/components/SelectField";
import {
  formatEuro,
  formatEuroWhole,
  formatMoneyInput,
  formatNumberInput,
  formatPercent,
  parseGermanNumber,
  parseMoney,
} from "@/lib/engine/format";
import { berechneNettoSparplan } from "@/lib/engine/finance/netto-sparplan";
import { FONDS_ARTEN, type FondsArt } from "@/lib/engine/tax/teilfreistellung";
import type { Kirchensteuer } from "@/lib/engine/tax/kapitalertragsteuer";
import { LAST_BASISZINS_YEAR } from "@/lib/engine/tax/basiszins";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULTS = {
  startkapital: 10_000_00,
  monatlicheSparrate: 300_00,
  rendite: 7,
  jahre: 20,
  sparerpauschbetragProJahr: 1_000_00,
};
const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

export function NettoSparplanRechner() {
  const [fondsArt, setFondsArt] = useState<FondsArt>("aktienfonds");
  const [kirchensteuer, setKirchensteuer] = useState<Kirchensteuer>("keine");
  const [fields, setFields] = useState({
    startkapital: formatMoneyInput(DEFAULTS.startkapital),
    monatlicheSparrate: formatMoneyInput(DEFAULTS.monatlicheSparrate),
    rendite: formatNumberInput(DEFAULTS.rendite),
    jahre: formatNumberInput(DEFAULTS.jahre),
    sparerpauschbetragProJahr: formatMoneyInput(DEFAULTS.sparerpauschbetragProJahr),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const startkapital = parseMoney(fields.startkapital);
    const monatlicheSparrate = parseMoney(fields.monatlicheSparrate);
    const sparerpauschbetragProJahr = parseMoney(fields.sparerpauschbetragProJahr);
    const rendite = parseGermanNumber(fields.rendite);
    const jahre = parseGermanNumber(fields.jahre);
    const range = {
      startkapital: outOfRange(startkapital, 0, MAX_MONEY),
      monatlicheSparrate: outOfRange(monatlicheSparrate, 0, MAX_MONEY),
      sparerpauschbetragProJahr: outOfRange(sparerpauschbetragProJahr, 0, MAX_MONEY),
      rendite: outOfRange(rendite, -50, 50),
      jahre: outOfRange(jahre, 1, 50),
    };
    return {
      values: {
        startkapital: startkapital ?? DEFAULTS.startkapital,
        monatlicheSparrate: monatlicheSparrate ?? DEFAULTS.monatlicheSparrate,
        sparerpauschbetragProJahr:
          sparerpauschbetragProJahr ?? DEFAULTS.sparerpauschbetragProJahr,
        rendite: rendite ?? DEFAULTS.rendite,
        jahre: Math.round(jahre ?? DEFAULTS.jahre),
      },
      range,
      invalid: {
        startkapital: startkapital === null || range.startkapital,
        monatlicheSparrate: monatlicheSparrate === null || range.monatlicheSparrate,
        sparerpauschbetragProJahr:
          sparerpauschbetragProJahr === null || range.sparerpauschbetragProJahr,
        rendite: rendite === null || range.rendite,
        jahre: jahre === null || range.jahre,
      },
    };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (p) => {
      const f = p.get("f");
      if (FONDS_ARTEN.some((x) => x.id === f)) setFondsArt(f as FondsArt);
      const k = p.get("k");
      if (k === "acht" || k === "neun" || k === "keine") setKirchensteuer(k);
      setFields({
        startkapital: formatMoneyInput(readMoney(p, "k", DEFAULTS.startkapital, MAX_MONEY)),
        monatlicheSparrate: formatMoneyInput(readMoney(p, "m", DEFAULTS.monatlicheSparrate, MAX_MONEY)),
        sparerpauschbetragProJahr: formatMoneyInput(
          readMoney(p, "s", DEFAULTS.sparerpauschbetragProJahr, MAX_MONEY),
        ),
        rendite: formatNumberInput(readNumber(p, "r", DEFAULTS.rendite, -50, 50)),
        jahre: formatNumberInput(Math.round(readNumber(p, "j", DEFAULTS.jahre, 1, 50))),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("k", moneyParam(parsed.values.startkapital));
      p.set("m", moneyParam(parsed.values.monatlicheSparrate));
      p.set("r", numberParam(parsed.values.rendite));
      p.set("j", numberParam(parsed.values.jahre));
      p.set("s", moneyParam(parsed.values.sparerpauschbetragProJahr));
      p.set("f", fondsArt);
      if (kirchensteuer !== "keine") p.set("k2", kirchensteuer);
      return p;
    },
    !incomplete,
    `${fondsArt}|${kirchensteuer}|${JSON.stringify(parsed.values)}`,
  );

  const r = useMemo(
    () =>
      incomplete
        ? null
        : berechneNettoSparplan({
            ...parsed.values,
            startjahr: LAST_BASISZINS_YEAR,
            fondsArt,
            kirchensteuer,
          }),
    [incomplete, parsed.values, fondsArt, kirchensteuer],
  );

  return (
    <div className="calc-grid">
      <form
        className="card calc-form order-2 flex flex-col gap-4 p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField id="startkapital" label="Einmalanlage" suffix="€"
          value={fields.startkapital} onChange={set("startkapital")}
          invalid={parsed.invalid.startkapital} error="Bitte eine Zahl eingeben." />
        <NumberField id="monatlicheSparrate" label="Monatliche Sparrate" suffix="€"
          value={fields.monatlicheSparrate} onChange={set("monatlicheSparrate")}
          invalid={parsed.invalid.monatlicheSparrate} error="Bitte eine Zahl eingeben." />
        <NumberField id="rendite" label="Rendite pro Jahr" suffix="%"
          value={fields.rendite} onChange={set("rendite")}
          invalid={parsed.invalid.rendite}
          error={parsed.range.rendite ? "Zwischen -50 und 50 %." : "Bitte eine Zahl eingeben."} />
        <NumberField id="jahre" label="Anlagedauer" suffix="Jahre"
          value={fields.jahre} onChange={set("jahre")}
          invalid={parsed.invalid.jahre}
          error={parsed.range.jahre ? "Zwischen 1 und 50 Jahren." : "Bitte eine Zahl eingeben."} />
        <SelectField id="fondsArt" label="Fondsart" value={fondsArt} onChange={setFondsArt}
          options={FONDS_ARTEN.map((f) => ({ value: f.id, label: f.label }))}
          hint={FONDS_ARTEN.find((f) => f.id === fondsArt)?.hint} />
        <NumberField id="sparerpauschbetragProJahr" label="Sparerpauschbetrag pro Jahr" suffix="€"
          value={fields.sparerpauschbetragProJahr} onChange={set("sparerpauschbetragProJahr")}
          invalid={parsed.invalid.sparerpauschbetragProJahr}
          hint="Soweit für diesen Sparplan verfügbar."
          error="Bitte eine Zahl eingeben." />
        <SelectField id="kirchensteuer" label="Kirchensteuer" value={kirchensteuer}
          onChange={setKirchensteuer}
          options={[
            { value: "keine", label: "keine" },
            { value: "acht", label: "8 % (BY, BW)" },
            { value: "neun", label: "9 % (übrige Länder)" },
          ]} />
      </form>

      <div data-result-card
        className="card order-1 p-5">
        <p data-result-label className="text-sm font-medium text-muted">Endkapital nach Steuern</p>
        <p data-result-value className="mt-1.5 overflow-x-auto text-4xl sm:text-5xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatEuro(r.endkapitalNetto)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              brutto wären es {formatEuro(r.endkapitalBrutto)} — die Steuer
              nimmt {formatPercent(r.steuerquote, 1)} des Gewinns
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Steuer in der Ansparphase</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.steuerAnsparphase)}
                </dd>
                <p className="text-xs text-muted">
                  jährliche Vorabpauschale, zusammen{" "}
                  {formatEuro(r.vorabpauschalenGesamt)}
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Steuer beim Verkauf</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(r.steuerBeimVerkauf)}
                </dd>
                <p className="text-xs text-muted">
                  Vorabpauschalen bereits angerechnet
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Eingezahlt</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.eingezahlt)}
                </dd>
              </div>
            </dl>
            <CopyLinkButton
              scenarioKey={`${fondsArt}|${kirchensteuer}|${JSON.stringify(parsed.values)}`}
            />
          </>
        )}
      </div>

      {r === null ? null : (
        <div className="card table-scroll order-3">
          <table className="data-table w-full min-w-xl text-right text-sm tabular-nums">
            <caption className="border-b border-border bg-surface px-4 py-3 text-left font-medium">
              Ansparphase Jahr für Jahr
            </caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Jahr</th>
                <th scope="col" className="px-4 py-2 font-medium">Eingezahlt</th>
                <th scope="col" className="px-4 py-2 font-medium">Wert am Ende</th>
                <th scope="col" className="px-4 py-2 font-medium">Vorabpauschale</th>
                <th scope="col" className="px-4 py-2 font-medium">Steuer</th>
              </tr>
            </thead>
            <tbody>
              {r.jahre.map((row) => (
                <tr key={row.jahr} className="border-t border-border">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {row.kalenderjahr}
                  </th>
                  <td className="px-4 py-2">{formatEuroWhole(row.eingezahlt)}</td>
                  <td className="px-4 py-2 font-medium">{formatEuroWhole(row.wertJahresende)}</td>
                  <td className="px-4 py-2 text-muted">{formatEuroWhole(row.vorabpauschale)}</td>
                  <td className="px-4 py-2 text-accent">{formatEuroWhole(row.steuerImJahr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-3 text-xs text-muted">
            {r.basiszinsFortgeschrieben
              ? `Der Basiszins ist nur bis ${LAST_BASISZINS_YEAR} veröffentlicht; für spätere Jahre wird der letzte Wert fortgeschrieben. `
              : ""}
            Die Steuer auf die Vorabpauschale wird vom Verrechnungskonto
            abgebucht und mindert das angelegte Kapital hier nicht.
          </p>
        </div>
      )}
    </div>
  );
}
