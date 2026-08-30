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
import { berechneSozialversicherung } from "@/lib/engine/tax/sozialversicherung";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";
import * as K from "@/lib/engine/tax/constants/2026";

const MAX_MONEY = 100_000_000_00;
const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

export function SozialabgabenRechner() {
  const [kinderlos, setKinderlos] = useState<"ja" | "nein">("nein");
  const [fields, setFields] = useState({
    bruttoMonat: formatMoneyInput(4_000_00),
    zusatzbeitrag: formatNumberInput(K.KV_ZUSATZBEITRAG_DURCHSCHNITT * 100),
    kinderUnter25: formatNumberInput(0),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const bruttoMonat = parseMoney(fields.bruttoMonat);
    const zusatzbeitrag = parseGermanNumber(fields.zusatzbeitrag);
    const kinderUnter25 = parseGermanNumber(fields.kinderUnter25);
    const range = {
      bruttoMonat: outOfRange(bruttoMonat, 0, MAX_MONEY),
      zusatzbeitrag: outOfRange(zusatzbeitrag, 0, 10),
      kinderUnter25: outOfRange(kinderUnter25, 0, 15),
    };
    return {
      values: {
        bruttoMonat: bruttoMonat ?? 0,
        zusatzbeitrag: zusatzbeitrag ?? 2.9,
        kinderUnter25: Math.round(kinderUnter25 ?? 0),
        kinderlos: kinderlos === "ja",
      },
      range,
      invalid: {
        bruttoMonat: bruttoMonat === null || range.bruttoMonat,
        zusatzbeitrag: zusatzbeitrag === null || range.zusatzbeitrag,
        kinderUnter25: kinderUnter25 === null || range.kinderUnter25,
      },
    };
  }, [fields, kinderlos]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (params) => {
      setFields({
        bruttoMonat: formatMoneyInput(readMoney(params, "b", 4_000_00, MAX_MONEY)),
        zusatzbeitrag: formatNumberInput(readNumber(params, "z", 2.9, 0, 10)),
        kinderUnter25: formatNumberInput(
          Math.round(readNumber(params, "ki", 0, 0, 15)),
        ),
      });
      setKinderlos(params.get("kl") === "ja" ? "ja" : "nein");
    },
    () => {
      const p = new URLSearchParams();
      p.set("b", moneyParam(parsed.values.bruttoMonat));
      p.set("z", numberParam(parsed.values.zusatzbeitrag));
      p.set("ki", numberParam(parsed.values.kinderUnter25));
      if (parsed.values.kinderlos) p.set("kl", "ja");
      return p;
    },
    !incomplete,
    parsed.values,
  );

  const r = useMemo(
    () => (incomplete ? null : berechneSozialversicherung(parsed.values)),
    [incomplete, parsed.values],
  );

  const zweige = r
    ? ([
        ["Krankenversicherung", r.kranken],
        ["Pflegeversicherung", r.pflege],
        ["Rentenversicherung", r.rente],
        ["Arbeitslosenversicherung", r.arbeitslos],
        ["Gesamt", r.gesamt],
      ] as const)
    : [];

  return (
    <div className="calc-grid">
      <form
        className="card calc-form order-2 flex flex-col gap-4 p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField
          id="bruttoMonat"
          label="Bruttolohn pro Monat"
          suffix="€"
          value={fields.bruttoMonat}
          onChange={set("bruttoMonat")}
          invalid={parsed.invalid.bruttoMonat}
          error="Bitte eine Zahl eingeben."
        />
        <NumberField
          id="zusatzbeitrag"
          label="Zusatzbeitrag der Kasse"
          suffix="%"
          value={fields.zusatzbeitrag}
          onChange={set("zusatzbeitrag")}
          invalid={parsed.invalid.zusatzbeitrag}
          hint={`Durchschnitt ${formatPercent(K.KV_ZUSATZBEITRAG_DURCHSCHNITT * 100, 1)} — deine Kasse kann abweichen.`}
          error={
            parsed.range.zusatzbeitrag
              ? "Zwischen 0 und 10 %."
              : "Bitte eine Zahl eingeben."
          }
        />
        <SelectField
          id="kinderlos"
          label="Kinderlos ab 23"
          value={kinderlos}
          onChange={setKinderlos}
          options={[
            { value: "nein", label: "nein" },
            { value: "ja", label: "ja" },
          ]}
          hint={`Zuschlag ${formatPercent(K.PV_KINDERLOSENZUSCHLAG * 100, 1)} in der Pflegeversicherung, allein vom Arbeitnehmer.`}
        />
        <NumberField
          id="kinderUnter25"
          label="Kinder unter 25"
          suffix="Kinder"
          value={fields.kinderUnter25}
          onChange={set("kinderUnter25")}
          invalid={parsed.invalid.kinderUnter25}
          hint="Ab dem zweiten bis fünften Kind je 0,25 % weniger."
          error={
            parsed.range.kinderUnter25
              ? "Zwischen 0 und 15."
              : "Bitte eine Zahl eingeben."
          }
        />
      </form>

      <div data-result-card
        className="card order-1 p-5">
        <p data-result-label className="text-sm font-medium text-muted">Dein Anteil pro Monat</p>
        <p data-result-value className="mt-1.5 overflow-x-auto text-4xl sm:text-5xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatEuro(r.gesamt.arbeitnehmer)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              vom Brutto bleiben {formatEuro(r.nettoVorSteuer)} — vor Lohnsteuer
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Arbeitgeber zahlt</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.gesamt.arbeitgeber)}
                </dd>
                <p className="text-xs text-muted">zusätzlich zum Bruttolohn</p>
              </div>
              <div>
                <dt className="text-sm text-muted">Gesamtkosten der Stelle</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(parsed.values.bruttoMonat + r.gesamt.arbeitgeber)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Beitragsbemessung</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(r.bemessungKvPv)}
                </dd>
                <p className="text-xs text-muted">
                  {r.bbgErreichtKvPv
                    ? "KV/PV gedeckelt — darüber fallen keine Beiträge an"
                    : "unter der Beitragsbemessungsgrenze"}
                </p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={JSON.stringify(parsed.values)} />
          </>
        )}
      </div>

      {r === null ? null : (
        <div className="card table-scroll order-3">
          <table className="data-table w-full min-w-xl text-right text-sm tabular-nums">
            <caption className="border-b border-border bg-surface px-4 py-3 text-left font-medium">
              Beiträge nach Zweig — Stand {K.STAND}
            </caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Zweig</th>
                <th scope="col" className="px-4 py-2 font-medium">Arbeitnehmer</th>
                <th scope="col" className="px-4 py-2 font-medium">Arbeitgeber</th>
                <th scope="col" className="px-4 py-2 font-medium">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {zweige.map(([label, z], i) => (
                <tr
                  key={label}
                  className={`border-t border-border ${
                    i === zweige.length - 1 ? "font-medium" : ""
                  }`}
                >
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {label}
                  </th>
                  <td className="px-4 py-2">{formatEuro(z.arbeitnehmer)}</td>
                  <td className="px-4 py-2 text-muted">{formatEuro(z.arbeitgeber)}</td>
                  <td className="px-4 py-2">{formatEuro(z.gesamt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-3 text-xs text-muted">
            Quelle der Rechengrößen: {K.QUELLE}. Ohne Lohnsteuer — die folgt im
            Brutto-Netto-Rechner.
          </p>
        </div>
      )}
    </div>
  );
}
