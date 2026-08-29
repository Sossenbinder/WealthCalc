"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import { SelectField } from "@/components/SelectField";
import { formatEuro, formatMoneyInput, formatPercent, parseMoney } from "@/lib/engine/format";
import { berechneKirchensteuerLast } from "@/lib/engine/tax/kirchensteuer-last";
import type { Veranlagung } from "@/lib/engine/tax/einkommensteuer";
import { moneyParam, readMoney, useScenarioUrl } from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULT_ZVE = 60_000_00;

export function KirchensteuerRechner() {
  const [veranlagung, setVeranlagung] = useState<Veranlagung>("einzel");
  const [satz, setSatz] = useState<"8" | "9">("9");
  const [zvEField, setZvEField] = useState(formatMoneyInput(DEFAULT_ZVE));

  const parsed = useMemo(() => {
    const zvE = parseMoney(zvEField);
    return {
      zvE: zvE ?? DEFAULT_ZVE,
      invalid: zvE === null || zvE < 0 || zvE > MAX_MONEY,
    };
  }, [zvEField]);

  useScenarioUrl(
    (p) => {
      const v = p.get("v");
      if (v === "zusammen" || v === "einzel") setVeranlagung(v);
      if (p.get("s") === "8") setSatz("8");
      setZvEField(formatMoneyInput(readMoney(p, "z", DEFAULT_ZVE, MAX_MONEY)));
    },
    () => {
      const p = new URLSearchParams();
      p.set("z", moneyParam(parsed.zvE));
      if (veranlagung !== "einzel") p.set("v", veranlagung);
      if (satz === "8") p.set("s", "8");
      return p;
    },
    !parsed.invalid,
    `${veranlagung}|${satz}|${parsed.zvE}`,
  );

  const r = useMemo(
    () =>
      parsed.invalid
        ? null
        : berechneKirchensteuerLast({
            zvE: parsed.zvE,
            veranlagung,
            satz: Number(satz),
          }),
    [parsed, veranlagung, satz],
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField id="zvE" label="Zu versteuerndes Einkommen" suffix="€"
          value={zvEField} onChange={setZvEField} invalid={parsed.invalid}
          hint="Pro Jahr, nach allen Abzügen."
          error="Bitte eine Zahl eingeben." />
        <SelectField id="satz" label="Kirchensteuersatz" value={satz} onChange={setSatz}
          options={[
            { value: "9", label: "9 % — übrige Bundesländer" },
            { value: "8", label: "8 % — Bayern und Baden-Württemberg" },
          ]} />
        <SelectField id="veranlagung" label="Veranlagung" value={veranlagung} onChange={setVeranlagung}
          options={[
            { value: "einzel", label: "Einzelveranlagung" },
            { value: "zusammen", label: "Zusammenveranlagung (Splitting)" },
          ]} />
      </form>

      <div className="order-1 rounded-xl border border-border bg-surface p-5 lg:col-start-2 lg:row-start-1">
        <p className="text-sm text-muted">Kirchensteuer im Jahr</p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatEuro(r.kirchensteuer)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingabe prüfen.</p>
        ) : r.kirchensteuer === 0 ? (
          <p className="mt-1 text-sm text-muted">
            Ohne Einkommensteuer fällt auch keine Kirchensteuer an.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              netto etwa {formatEuro(r.nettokosten)}, weil der
              Sonderausgabenabzug {formatEuro(r.entlastung)} zurückholt
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Pro Monat</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(Math.round(r.nettokosten / 12))}
                </dd>
                <p className="text-xs text-muted">netto gerechnet</p>
              </div>
              <div>
                <dt className="text-sm text-muted">Anteil am Einkommen</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatPercent(r.anteilAmEinkommen, 2)}
                </dd>
                <p className="text-xs text-muted">
                  nicht {formatPercent(Number(satz), 0)} — die beziehen sich auf die Steuer
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">In 30 Jahren</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.hochrechnung30Jahre)}
                </dd>
                <p className="text-xs text-muted">
                  bei gleichem Einkommen, ohne Verzinsung
                </p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={`${veranlagung}|${satz}|${parsed.zvE}`} />
          </>
        )}
      </div>

      {r === null || r.kirchensteuer === 0 ? null : (
        <div className="order-3 overflow-x-auto rounded-xl border border-border bg-surface lg:col-start-2 lg:row-start-2">
          <table className="w-full text-right text-sm tabular-nums">
            <caption className="border-b border-border px-4 py-3 text-left font-medium">
              Rechenweg
            </caption>
            <tbody>
              {[
                ["Zu versteuerndes Einkommen", parsed.zvE],
                ["Einkommensteuer (§ 32a EStG)", r.einkommensteuer],
                [`Kirchensteuer (${satz} % davon)`, r.kirchensteuer],
                [`Entlastung durch Sonderausgabenabzug (${formatPercent(r.grenzsteuersatz, 1)})`, -r.entlastung || 0],
                ["Bleibt als Belastung", r.nettokosten],
              ].map(([label, value], i, all) => (
                <tr key={label as string} className={`border-t border-border ${i === all.length - 1 ? "font-medium" : ""}`}>
                  <th scope="row" className="px-4 py-2 text-left font-normal">{label as string}</th>
                  <td className="px-4 py-2">{formatEuro(value as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-3 text-xs text-muted">
            Die Entlastung ist geschätzt: der Sonderausgabenabzug wirkt in der
            Veranlagung des Jahres, in dem die Kirchensteuer gezahlt wurde, und
            ein grosser Abzug wandert die Progression hinunter. Für übliche
            Einkommen liegt die Schätzung nahe am tatsächlichen Wert.
          </p>
        </div>
      )}
    </div>
  );
}
