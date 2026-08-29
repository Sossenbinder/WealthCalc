"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import { SelectField } from "@/components/SelectField";
import {
  formatEuro,
  formatMoneyInput,
  formatPercent,
  parseMoney,
} from "@/lib/engine/format";
import {
  berechneEinkommensteuer,
  GRUNDFREIBETRAG_EUR,
  type Veranlagung,
} from "@/lib/engine/tax/einkommensteuer";
import type { Kirchensteuer } from "@/lib/engine/tax/kapitalertragsteuer";
import { moneyParam, readMoney, useScenarioUrl } from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULT_ZVE = 60_000_00;

export function EinkommensteuerRechner() {
  const [veranlagung, setVeranlagung] = useState<Veranlagung>("einzel");
  const [kirchensteuer, setKirchensteuer] = useState<Kirchensteuer>("keine");
  const [zvEField, setZvEField] = useState(formatMoneyInput(DEFAULT_ZVE));

  const parsed = useMemo(() => {
    const zvE = parseMoney(zvEField);
    const invalid = zvE === null || zvE < 0 || zvE > MAX_MONEY;
    return { zvE: zvE ?? DEFAULT_ZVE, invalid };
  }, [zvEField]);

  useScenarioUrl(
    (p) => {
      const v = p.get("v");
      if (v === "zusammen" || v === "einzel") setVeranlagung(v);
      const k = p.get("k");
      if (k === "acht" || k === "neun" || k === "keine") setKirchensteuer(k);
      setZvEField(formatMoneyInput(readMoney(p, "z", DEFAULT_ZVE, MAX_MONEY)));
    },
    () => {
      const p = new URLSearchParams();
      p.set("z", moneyParam(parsed.zvE));
      if (veranlagung !== "einzel") p.set("v", veranlagung);
      if (kirchensteuer !== "keine") p.set("k", kirchensteuer);
      return p;
    },
    !parsed.invalid,
    `${veranlagung}|${kirchensteuer}|${parsed.zvE}`,
  );

  const r = useMemo(
    () =>
      parsed.invalid
        ? null
        : berechneEinkommensteuer({
            zvE: parsed.zvE,
            veranlagung,
            kirchensteuer,
          }),
    [parsed, veranlagung, kirchensteuer],
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField
          id="zvE"
          label="Zu versteuerndes Einkommen"
          suffix="€"
          value={zvEField}
          onChange={setZvEField}
          invalid={parsed.invalid}
          hint="Pro Jahr, nach allen Abzügen und Freibeträgen."
          error="Bitte eine Zahl eingeben."
        />
        <SelectField
          id="veranlagung"
          label="Veranlagung"
          value={veranlagung}
          onChange={setVeranlagung}
          options={[
            { value: "einzel", label: "Einzelveranlagung" },
            { value: "zusammen", label: "Zusammenveranlagung (Splitting)" },
          ]}
          hint={
            veranlagung === "zusammen"
              ? "Der Tarif wird auf die Hälfte angewandt und verdoppelt."
              : `Grundfreibetrag ${formatEuro(GRUNDFREIBETRAG_EUR * 100)}.`
          }
        />
        <SelectField
          id="kirchensteuer"
          label="Kirchensteuer"
          value={kirchensteuer}
          onChange={setKirchensteuer}
          options={[
            { value: "keine", label: "keine" },
            { value: "acht", label: "8 % (BY, BW)" },
            { value: "neun", label: "9 % (übrige Länder)" },
          ]}
        />
      </form>

      <div className="order-1 rounded-xl border border-border bg-surface p-5 lg:col-start-2 lg:row-start-1">
        <p className="text-sm text-muted">Steuer insgesamt</p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatEuro(r.gesamt)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingabe prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              es bleiben {formatEuro(r.nettoEinkommen)} vom zu versteuernden
              Einkommen
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Durchschnittssteuersatz</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatPercent(r.durchschnittssteuersatz, 2)}
                </dd>
                <p className="text-xs text-muted">auf das gesamte Einkommen</p>
              </div>
              <div>
                <dt className="text-sm text-muted">Grenzsteuersatz</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatPercent(r.grenzsteuersatz, 2)}
                </dd>
                <p className="text-xs text-muted">auf den nächsten Euro</p>
              </div>
              <div>
                <dt className="text-sm text-muted">Solidaritätszuschlag</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.soli)}
                </dd>
                <p className="text-xs text-muted">
                  {r.soli === 0
                    ? "unter der Freigrenze — fällt nicht an"
                    : "5,5 %, in der Milderungszone gedeckelt"}
                </p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={`${veranlagung}|${kirchensteuer}|${parsed.zvE}`} />
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
                ["Zu versteuerndes Einkommen", parsed.zvE],
                ["Einkommensteuer (§ 32a EStG)", r.einkommensteuer],
                ["Solidaritätszuschlag", r.soli],
                ["Kirchensteuer", r.kirchensteuer],
                ["Steuer gesamt", r.gesamt],
                ["Bleibt", r.nettoEinkommen],
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
          <p className="border-t border-border px-4 py-3 text-xs text-muted">
            Veranlagte Einkommensteuer nach § 32a EStG, Stand 2026 — nicht die
            monatliche Lohnsteuer, die dem amtlichen Programmablaufplan mit
            Steuerklassen folgt.
          </p>
        </div>
      )}
    </div>
  );
}
