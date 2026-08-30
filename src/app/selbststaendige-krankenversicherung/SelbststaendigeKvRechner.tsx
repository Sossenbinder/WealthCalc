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
import { berechneSelbststaendigeKv } from "@/lib/engine/tax/selbststaendige-kv";
import * as K from "@/lib/engine/tax/constants/2026";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULTS = { einkommenMonat: 4_000_00, zusatzbeitrag: 2.9 };

export function SelbststaendigeKvRechner() {
  const [krankengeld, setKrankengeld] = useState<"ja" | "nein">("ja");
  const [kinderlos, setKinderlos] = useState<"ja" | "nein">("nein");
  const [fields, setFields] = useState({
    einkommenMonat: formatMoneyInput(DEFAULTS.einkommenMonat),
    zusatzbeitrag: formatNumberInput(DEFAULTS.zusatzbeitrag),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const einkommenMonat = parseMoney(fields.einkommenMonat);
    const zusatzbeitrag = parseGermanNumber(fields.zusatzbeitrag);
    const range = { zusatzbeitrag: zusatzbeitrag !== null && (zusatzbeitrag < 0 || zusatzbeitrag > 10) };
    return {
      values: {
        einkommenMonat: einkommenMonat ?? DEFAULTS.einkommenMonat,
        zusatzbeitrag: zusatzbeitrag ?? DEFAULTS.zusatzbeitrag,
      },
      range,
      invalid: {
        einkommenMonat:
          einkommenMonat === null || einkommenMonat < 0 || einkommenMonat > MAX_MONEY,
        zusatzbeitrag: zusatzbeitrag === null || range.zusatzbeitrag,
      },
    };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (p) => {
      setKrankengeld(p.get("kg") === "nein" ? "nein" : "ja");
      setKinderlos(p.get("kl") === "ja" ? "ja" : "nein");
      setFields({
        einkommenMonat: formatMoneyInput(readMoney(p, "e", DEFAULTS.einkommenMonat, MAX_MONEY)),
        zusatzbeitrag: formatNumberInput(readNumber(p, "z", DEFAULTS.zusatzbeitrag, 0, 10)),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("e", moneyParam(parsed.values.einkommenMonat));
      p.set("z", numberParam(parsed.values.zusatzbeitrag));
      if (krankengeld === "nein") p.set("kg", "nein");
      if (kinderlos === "ja") p.set("kl", "ja");
      return p;
    },
    !incomplete,
    `${krankengeld}|${kinderlos}|${JSON.stringify(parsed.values)}`,
  );

  const r = useMemo(
    () =>
      incomplete
        ? null
        : berechneSelbststaendigeKv({
            ...parsed.values,
            mitKrankengeld: krankengeld === "ja",
            kinderlos: kinderlos === "ja",
          }),
    [incomplete, parsed.values, krankengeld, kinderlos],
  );

  return (
    <div className="calc-grid">
      <form
        className="card calc-form order-2 flex flex-col gap-4 p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField id="einkommenMonat" label="Gewinn pro Monat" suffix="€"
          value={fields.einkommenMonat} onChange={set("einkommenMonat")}
          invalid={parsed.invalid.einkommenMonat}
          hint={`Mindestens wird ${formatEuro(K.MINDESTBEMESSUNG_MONAT)} angesetzt.`}
          error="Bitte eine Zahl eingeben." />
        <NumberField id="zusatzbeitrag" label="Zusatzbeitrag der Kasse" suffix="%"
          value={fields.zusatzbeitrag} onChange={set("zusatzbeitrag")}
          invalid={parsed.invalid.zusatzbeitrag}
          hint={`Durchschnitt ${formatPercent(K.KV_ZUSATZBEITRAG_DURCHSCHNITT * 100, 1)}.`}
          error={parsed.range.zusatzbeitrag ? "Zwischen 0 und 10 %." : "Bitte eine Zahl eingeben."} />
        <SelectField id="krankengeld" label="Mit Krankengeld" value={krankengeld}
          onChange={setKrankengeld}
          options={[{ value: "ja", label: "ja — allgemeiner Satz" }, { value: "nein", label: "nein — ermäßigter Satz" }]}
          hint={`${formatPercent(K.KV_ALLGEMEIN * 100, 1)} statt ${formatPercent(K.KV_ERMAESSIGT * 100, 1)}; ohne Krankengeld zahlt niemand für die ersten sechs Wochen.`} />
        <SelectField id="kinderlos" label="Kinderlos ab 23" value={kinderlos}
          onChange={setKinderlos}
          options={[{ value: "nein", label: "nein" }, { value: "ja", label: "ja" }]}
          hint={`Zuschlag ${formatPercent(K.PV_KINDERLOSENZUSCHLAG * 100, 1)} in der Pflegeversicherung.`} />
      </form>

      <div data-result-card
        className="card order-1 p-5">
        <p data-result-label className="text-sm font-medium text-muted">Beitrag pro Monat</p>
        <p data-result-value className="mt-1.5 overflow-x-auto text-4xl sm:text-5xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatEuro(r.gesamt)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {formatPercent(r.effektiverSatz, 1)} deines Gewinns
              {r.mindestbemessungGreift
                ? " — die Mindestbemessungsgrundlage greift, der Beitrag sinkt nicht weiter"
                : r.bbgErreicht
                  ? " — über der Beitragsbemessungsgrenze steigt er nicht weiter"
                  : ""}
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Krankenversicherung</dt>
                <dd className="text-lg font-medium tabular-nums">{formatEuro(r.kranken)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Pflegeversicherung</dt>
                <dd className="text-lg font-medium tabular-nums">{formatEuro(r.pflege)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Als Angestellte wären es</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(r.vergleichAngestellt)}
                </dd>
                <p className="text-xs text-muted">
                  weil die Hälfte der Arbeitgeber trüge
                </p>
              </div>
            </dl>
            <CopyLinkButton
              scenarioKey={`${krankengeld}|${kinderlos}|${JSON.stringify(parsed.values)}`}
            />
          </>
        )}
      </div>

      {r === null ? null : (
        <div className="card table-scroll order-3">
          <table className="data-table w-full text-right text-sm tabular-nums">
            <caption className="border-b border-border bg-surface px-4 py-3 text-left font-medium">
              Rechenweg — Stand {K.STAND}
            </caption>
            <tbody>
              {[
                ["Gewinn pro Monat", parsed.values.einkommenMonat],
                ["Beitragspflichtige Einnahme", r.bemessung],
                ["Krankenversicherung", r.kranken],
                ["Pflegeversicherung", r.pflege],
                ["Beitrag gesamt", r.gesamt],
              ].map(([label, value], i, all) => (
                <tr key={label as string} className={`border-t border-border ${i === all.length - 1 ? "font-medium" : ""}`}>
                  <th scope="row" className="px-4 py-2 text-left font-normal">{label as string}</th>
                  <td className="px-4 py-2">{formatEuro(value as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-3 text-xs text-muted">
            Quelle der Rechengrößen: {K.QUELLE}. Ohne Rentenversicherung —
            selbstständige Personen sind dort meist nicht pflichtversichert,
            einige Berufsgruppen aber schon.
          </p>
        </div>
      )}
    </div>
  );
}
