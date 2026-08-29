"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import { SelectField } from "@/components/SelectField";
import { formatEuro, formatMoneyInput, formatPercent, parseMoney } from "@/lib/engine/format";
import { berechneAbfindung } from "@/lib/engine/tax/abfindung";
import type { Veranlagung } from "@/lib/engine/tax/einkommensteuer";
import type { Kirchensteuer } from "@/lib/engine/tax/kapitalertragsteuer";
import { moneyParam, readMoney, useScenarioUrl } from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULTS = { verbleibendesZvE: 50_000_00, abfindung: 100_000_00 };

export function AbfindungRechner() {
  const [veranlagung, setVeranlagung] = useState<Veranlagung>("einzel");
  const [kirchensteuer, setKirchensteuer] = useState<Kirchensteuer>("keine");
  const [fields, setFields] = useState({
    verbleibendesZvE: formatMoneyInput(DEFAULTS.verbleibendesZvE),
    abfindung: formatMoneyInput(DEFAULTS.abfindung),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const verbleibendesZvE = parseMoney(fields.verbleibendesZvE);
    const abfindung = parseMoney(fields.abfindung);
    const invalid = {
      verbleibendesZvE:
        verbleibendesZvE === null || verbleibendesZvE < 0 || verbleibendesZvE > MAX_MONEY,
      abfindung: abfindung === null || abfindung < 0 || abfindung > MAX_MONEY,
    };
    return {
      values: {
        verbleibendesZvE: verbleibendesZvE ?? DEFAULTS.verbleibendesZvE,
        abfindung: abfindung ?? DEFAULTS.abfindung,
      },
      invalid,
    };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (p) => {
      const v = p.get("v");
      if (v === "zusammen" || v === "einzel") setVeranlagung(v);
      const k = p.get("k");
      if (k === "acht" || k === "neun" || k === "keine") setKirchensteuer(k);
      setFields({
        verbleibendesZvE: formatMoneyInput(readMoney(p, "e", DEFAULTS.verbleibendesZvE, MAX_MONEY)),
        abfindung: formatMoneyInput(readMoney(p, "a", DEFAULTS.abfindung, MAX_MONEY)),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("e", moneyParam(parsed.values.verbleibendesZvE));
      p.set("a", moneyParam(parsed.values.abfindung));
      if (veranlagung !== "einzel") p.set("v", veranlagung);
      if (kirchensteuer !== "keine") p.set("k", kirchensteuer);
      return p;
    },
    !incomplete,
    `${veranlagung}|${kirchensteuer}|${JSON.stringify(parsed.values)}`,
  );

  const r = useMemo(
    () =>
      incomplete
        ? null
        : berechneAbfindung({ ...parsed.values, veranlagung, kirchensteuer }),
    [incomplete, parsed.values, veranlagung, kirchensteuer],
  );

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField id="abfindung" label="Abfindung" suffix="€"
          value={fields.abfindung} onChange={set("abfindung")}
          invalid={parsed.invalid.abfindung} error="Bitte eine Zahl eingeben." />
        <NumberField id="verbleibendesZvE" label="Übriges zu versteuerndes Einkommen" suffix="€"
          value={fields.verbleibendesZvE} onChange={set("verbleibendesZvE")}
          invalid={parsed.invalid.verbleibendesZvE}
          hint="Im selben Jahr, ohne die Abfindung."
          error="Bitte eine Zahl eingeben." />
        <SelectField id="veranlagung" label="Veranlagung" value={veranlagung}
          onChange={setVeranlagung}
          options={[
            { value: "einzel", label: "Einzelveranlagung" },
            { value: "zusammen", label: "Zusammenveranlagung (Splitting)" },
          ]} />
        <SelectField id="kirchensteuer" label="Kirchensteuer" value={kirchensteuer}
          onChange={setKirchensteuer}
          options={[
            { value: "keine", label: "keine" },
            { value: "acht", label: "8 % (BY, BW)" },
            { value: "neun", label: "9 % (übrige Länder)" },
          ]} />
      </form>

      <div className="order-1 rounded-xl border border-border bg-surface p-5 lg:col-start-2 lg:row-start-1">
        <p className="text-sm text-muted">Von der Abfindung bleibt</p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatEuro(r.nettoAbfindung)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {formatEuro(r.steuerAbfindung)} Steuer auf die Abfindung — effektiv{" "}
              {formatPercent(r.effektiverSatz, 1)}
              {r.sonderfallOhneLaufendesEinkommen
                ? " (ohne übriges Einkommen, § 34 Abs. 1 Satz 3)"
                : ""}
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Fünftelregelung spart</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(r.ersparnis)}
                </dd>
                <p className="text-xs text-muted">
                  gegenüber {formatEuro(r.steuerOhneFuenftelregelung)} als
                  normales Einkommen
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Steuer insgesamt</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.steuerGesamt)}
                </dd>
                <p className="text-xs text-muted">
                  mit Soli und Kirchensteuer, inkl. laufendem Einkommen
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Steuer ohne Abfindung</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.steuerLaufend)}
                </dd>
                <p className="text-xs text-muted">auf das übrige Einkommen</p>
              </div>
            </dl>
            <CopyLinkButton
              scenarioKey={`${veranlagung}|${kirchensteuer}|${JSON.stringify(parsed.values)}`}
            />
          </>
        )}
      </div>

      {r === null ? null : (
        <div className="order-3 overflow-x-auto rounded-xl border border-border bg-surface lg:col-start-2 lg:row-start-2">
          <table className="w-full text-right text-sm tabular-nums">
            <caption className="border-b border-border px-4 py-3 text-left font-medium">
              Rechenweg nach § 34 Abs. 1 EStG
            </caption>
            <tbody>
              {[
                ["Übriges zu versteuerndes Einkommen", parsed.values.verbleibendesZvE],
                ["Einkommensteuer darauf", r.steuerLaufend],
                ["Abfindung", parsed.values.abfindung],
                ["Steuer auf die Abfindung (Fünftelregelung)", r.steuerAbfindung],
                ["Als normales Einkommen wären es", r.steuerOhneFuenftelregelung],
                ["Ersparnis", r.ersparnis],
                ["Solidaritätszuschlag", r.soli],
                ["Kirchensteuer", r.kirchensteuer],
                ["Steuer gesamt", r.steuerGesamt],
              ].map(([label, value], i, all) => (
                <tr
                  key={label as string}
                  className={`border-t border-border ${i === all.length - 1 ? "font-medium" : ""}`}
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
            Veranlagte Steuer nach § 34 EStG. Sozialversicherungsbeiträge fallen
            auf eine echte Abfindung nicht an; Werbungskosten und weitere
            aussergewöhnliche Einkünfte sind hier nicht abgebildet.
          </p>
        </div>
      )}
    </div>
  );
}
