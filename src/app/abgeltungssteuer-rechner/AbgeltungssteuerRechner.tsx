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
import { berechneAbgeltungssteuer } from "@/lib/engine/tax/abgeltungssteuer";
import { FONDS_ARTEN, type FondsArt } from "@/lib/engine/tax/teilfreistellung";
import type { Kirchensteuer } from "@/lib/engine/tax/kapitalertragsteuer";
import {
  moneyParam,
  readMoney,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULTS = {
  verkaufserloes: 50_000_00,
  kaufpreis: 30_000_00,
  versteuerteVorabpauschalen: 0,
  sparerpauschbetragRest: 1_000_00,
};

export function AbgeltungssteuerRechner() {
  const [fondsArt, setFondsArt] = useState<FondsArt>("aktienfonds");
  const [kirchensteuer, setKirchensteuer] = useState<Kirchensteuer>("keine");
  const [fields, setFields] = useState({
    verkaufserloes: formatMoneyInput(DEFAULTS.verkaufserloes),
    kaufpreis: formatMoneyInput(DEFAULTS.kaufpreis),
    versteuerteVorabpauschalen: formatMoneyInput(DEFAULTS.versteuerteVorabpauschalen),
    sparerpauschbetragRest: formatMoneyInput(DEFAULTS.sparerpauschbetragRest),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const values = {} as Record<keyof typeof fields, number>;
    const invalid = {} as Record<keyof typeof fields, boolean>;
    for (const k of Object.keys(fields) as (keyof typeof fields)[]) {
      const v = parseMoney(fields[k]);
      invalid[k] = v === null || v < 0 || v > MAX_MONEY;
      values[k] = v ?? DEFAULTS[k];
    }
    return { values, invalid };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (p) => {
      const art = p.get("f");
      if (FONDS_ARTEN.some((f) => f.id === art)) setFondsArt(art as FondsArt);
      const k = p.get("k");
      if (k === "acht" || k === "neun" || k === "keine") setKirchensteuer(k);
      setFields({
        verkaufserloes: formatMoneyInput(readMoney(p, "v", DEFAULTS.verkaufserloes, MAX_MONEY)),
        kaufpreis: formatMoneyInput(readMoney(p, "a", DEFAULTS.kaufpreis, MAX_MONEY)),
        versteuerteVorabpauschalen: formatMoneyInput(
          readMoney(p, "vp", DEFAULTS.versteuerteVorabpauschalen, MAX_MONEY),
        ),
        sparerpauschbetragRest: formatMoneyInput(
          readMoney(p, "s", DEFAULTS.sparerpauschbetragRest, MAX_MONEY),
        ),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("v", moneyParam(parsed.values.verkaufserloes));
      p.set("a", moneyParam(parsed.values.kaufpreis));
      p.set("vp", moneyParam(parsed.values.versteuerteVorabpauschalen));
      p.set("s", moneyParam(parsed.values.sparerpauschbetragRest));
      p.set("f", fondsArt);
      if (kirchensteuer !== "keine") p.set("k", kirchensteuer);
      return p;
    },
    !incomplete,
    `${fondsArt}|${kirchensteuer}|${JSON.stringify(parsed.values)}`,
  );

  const r = useMemo(
    () =>
      incomplete
        ? null
        : berechneAbgeltungssteuer({
            ...parsed.values,
            fondsArt,
            kirchensteuer,
          }),
    [incomplete, parsed.values, fondsArt, kirchensteuer],
  );

  const verlust = r !== null && r.rohgewinn < 0;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField
          id="verkaufserloes"
          label="Verkaufserlös"
          suffix="€"
          value={fields.verkaufserloes}
          onChange={set("verkaufserloes")}
          invalid={parsed.invalid.verkaufserloes}
          error="Bitte eine Zahl eingeben."
        />
        <NumberField
          id="kaufpreis"
          label="Kaufpreis"
          suffix="€"
          value={fields.kaufpreis}
          onChange={set("kaufpreis")}
          invalid={parsed.invalid.kaufpreis}
          hint="Was du ursprünglich bezahlt hast."
          error="Bitte eine Zahl eingeben."
        />
        <SelectField
          id="fondsArt"
          label="Fondsart"
          value={fondsArt}
          onChange={setFondsArt}
          options={FONDS_ARTEN.map((f) => ({ value: f.id, label: f.label }))}
          hint={FONDS_ARTEN.find((f) => f.id === fondsArt)?.hint}
        />
        <NumberField
          id="versteuerteVorabpauschalen"
          label="Versteuerte Vorabpauschalen"
          suffix="€"
          value={fields.versteuerteVorabpauschalen}
          onChange={set("versteuerteVorabpauschalen")}
          invalid={parsed.invalid.versteuerteVorabpauschalen}
          hint="Summe der Vorjahre — sie mindert den Gewinn."
          error="Bitte eine Zahl eingeben."
        />
        <NumberField
          id="sparerpauschbetragRest"
          label="Sparerpauschbetrag übrig"
          suffix="€"
          value={fields.sparerpauschbetragRest}
          onChange={set("sparerpauschbetragRest")}
          invalid={parsed.invalid.sparerpauschbetragRest}
          hint="1.000 € pro Person und Jahr."
          error="Bitte eine Zahl eingeben."
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
        <p className="text-sm text-muted">Steuer auf den Verkauf</p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatEuro(r.steuer.total)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : verlust ? (
          <>
            <p className="mt-1 text-sm text-muted">
              Ein Verlust von {formatEuro(-r.rohgewinn)} wird nicht besteuert.
              Die Verrechnung mit Gewinnen läuft über das ganze Jahr und ist
              hier nicht abgebildet.
            </p>
            {/* Auch ein Verlust ist ein Ergebnis, das man weitergeben will. */}
            <CopyLinkButton
              scenarioKey={`${fondsArt}|${kirchensteuer}|${JSON.stringify(parsed.values)}`}
            />
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              es bleiben {formatEuro(r.nettoerloes)} vom Erlös — effektiv{" "}
              {formatPercent(r.effektiverSteuersatz, 1)} auf den Gewinn
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Gewinn</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.gewinn)}
                </dd>
                {r.gewinn !== r.rohgewinn ? (
                  <p className="text-xs text-muted">
                    nach Anrechnung der Vorabpauschalen
                  </p>
                ) : null}
              </div>
              <div>
                <dt className="text-sm text-muted">Steuerpflichtig</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(r.bemessungsgrundlage)}
                </dd>
                <p className="text-xs text-muted">
                  {formatEuro(r.sparerpauschbetragGenutzt)} Freibetrag genutzt
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Nettoerlös</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.nettoerloes)}
                </dd>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={`${fondsArt}|${kirchensteuer}|${JSON.stringify(parsed.values)}`} />
          </>
        )}
      </div>

      {r === null || verlust ? null : (
        <div className="order-3 overflow-x-auto rounded-xl border border-border bg-surface lg:col-start-2 lg:row-start-2">
          <table className="w-full text-right text-sm tabular-nums">
            <caption className="border-b border-border px-4 py-3 text-left font-medium">
              Rechenweg
            </caption>
            <tbody>
              {[
                ["Verkaufserlös", parsed.values.verkaufserloes],
                // `|| 0` so a zero deduction renders as "0,00 €" and not
                // as negative zero, which JavaScript formats as "-0,00 €".
                ["abzüglich Kaufpreis", -parsed.values.kaufpreis || 0],
                [
                  "abzüglich versteuerter Vorabpauschalen",
                  -parsed.values.versteuerteVorabpauschalen || 0,
                ],
                ["Gewinn", r.gewinn],
                ["nach Teilfreistellung", r.nachTeilfreistellung],
                ["abzüglich Sparerpauschbetrag", -r.sparerpauschbetragGenutzt || 0],
                ["Bemessungsgrundlage", r.bemessungsgrundlage],
                ["Kapitalertragsteuer", r.steuer.kest],
                ["Solidaritätszuschlag", r.steuer.soli],
                ["Kirchensteuer", r.steuer.kist],
                ["Steuer gesamt", r.steuer.total],
              ].map(([label, value], i, all) => (
                <tr
                  key={label as string}
                  className={`border-t border-border ${
                    i === all.length - 1 ? "font-medium" : ""
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
        </div>
      )}
    </div>
  );
}
