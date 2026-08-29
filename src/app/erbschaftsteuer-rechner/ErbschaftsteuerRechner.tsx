"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import { SelectField } from "@/components/SelectField";
import { formatEuro, formatMoneyInput, formatPercent, parseMoney } from "@/lib/engine/format";
import {
  berechneErbschaftsteuer,
  VERWANDTSCHAFT,
} from "@/lib/engine/tax/erbschaftsteuer";
import { moneyParam, readMoney, useScenarioUrl } from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULT_ERWERB = 600_000_00;

export function ErbschaftsteuerRechner() {
  const [verwandtschaftId, setVerwandtschaftId] = useState("kind");
  const [erwerbField, setErwerbField] = useState(formatMoneyInput(DEFAULT_ERWERB));

  const parsed = useMemo(() => {
    const erwerb = parseMoney(erwerbField);
    return {
      erwerb: erwerb ?? DEFAULT_ERWERB,
      invalid: erwerb === null || erwerb < 0 || erwerb > MAX_MONEY,
    };
  }, [erwerbField]);

  useScenarioUrl(
    (p) => {
      const v = p.get("v");
      if (VERWANDTSCHAFT.some((x) => x.id === v)) setVerwandtschaftId(v!);
      setErwerbField(formatMoneyInput(readMoney(p, "e", DEFAULT_ERWERB, MAX_MONEY)));
    },
    () => {
      const p = new URLSearchParams();
      p.set("e", moneyParam(parsed.erwerb));
      p.set("v", verwandtschaftId);
      return p;
    },
    !parsed.invalid,
    `${verwandtschaftId}|${parsed.erwerb}`,
  );

  const r = useMemo(
    () =>
      parsed.invalid
        ? null
        : berechneErbschaftsteuer({ erwerb: parsed.erwerb, verwandtschaftId }),
    [parsed, verwandtschaftId],
  );
  const verwandt = VERWANDTSCHAFT.find((v) => v.id === verwandtschaftId);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField
          id="erwerb"
          label="Wert des Erwerbs"
          suffix="€"
          value={erwerbField}
          onChange={setErwerbField}
          invalid={parsed.invalid}
          hint="Erbe oder Schenkung, nach Abzug von Nachlassverbindlichkeiten."
          error="Bitte eine Zahl eingeben."
        />
        <SelectField
          id="verwandtschaft"
          label="Verhältnis zum Erblasser"
          value={verwandtschaftId}
          onChange={setVerwandtschaftId}
          options={VERWANDTSCHAFT.map((v) => ({ value: v.id, label: v.label }))}
          hint={
            verwandt
              ? `Steuerklasse ${verwandt.klasse}, Freibetrag ${formatEuro(verwandt.freibetrag)}.`
              : undefined
          }
        />
      </form>

      <div className="order-1 rounded-xl border border-border bg-surface p-5 lg:col-start-2 lg:row-start-1">
        <p className="text-sm text-muted">Erbschaftsteuer</p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatEuro(r.steuer)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingabe prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {r.steuer === 0
                ? `der Freibetrag von ${formatEuro(r.freibetrag)} deckt den Erwerb vollständig ab`
                : `es bleiben ${formatEuro(r.nettoErwerb)} — effektiv ${formatPercent(r.effektiverSatz, 1)} des Erwerbs`}
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Steuerpflichtig</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.steuerpflichtigerErwerb)}
                </dd>
                <p className="text-xs text-muted">
                  nach Freibetrag {formatEuro(r.freibetrag)}
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Steuersatz</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {r.steuersatz === 0 ? "—" : formatPercent(r.steuersatz, 0)}
                </dd>
                <p className="text-xs text-muted">
                  Steuerklasse {r.klasse}, auf den ganzen Betrag
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Härteausgleich</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {r.haerteausgleichGreift
                    ? `−${formatEuro(r.steuerOhneHaerteausgleich - r.steuer)}`
                    : "—"}
                </dd>
                <p className="text-xs text-muted">
                  {r.haerteausgleichGreift
                    ? "dämpft den Sprung an der Stufengrenze"
                    : "greift hier nicht"}
                </p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={`${verwandtschaftId}|${parsed.erwerb}`} />
          </>
        )}
      </div>

      {r === null ? null : (
        <div className="order-3 overflow-x-auto rounded-xl border border-border bg-surface lg:col-start-2 lg:row-start-2">
          <table className="w-full text-right text-sm tabular-nums">
            <caption className="border-b border-border px-4 py-3 text-left font-medium">
              Rechenweg nach §§ 16, 19 ErbStG
            </caption>
            <tbody>
              {[
                ["Wert des Erwerbs", parsed.erwerb],
                ["abzüglich Freibetrag", -r.freibetrag || 0],
                ["steuerpflichtiger Erwerb", r.steuerpflichtigerErwerb],
                [
                  `Steuer zum Satz der Stufe (${r.steuersatz} %)`,
                  r.steuerOhneHaerteausgleich,
                ],
                ...(r.haerteausgleichGreift
                  ? ([["Härteausgleich § 19 Abs. 3", r.steuer - r.steuerOhneHaerteausgleich]] as [string, number][])
                  : []),
                ["Erbschaftsteuer", r.steuer],
                ["Bleibt", r.nettoErwerb],
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
            Ohne Versorgungsfreibeträge, Zugewinnausgleich und die Verschonung
            von Betriebs- oder Familienheimvermögen. Freibeträge gelten je
            Erwerber und erneuern sich alle zehn Jahre.
          </p>
        </div>
      )}
    </div>
  );
}
