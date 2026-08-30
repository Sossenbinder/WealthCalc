"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import { SelectField } from "@/components/SelectField";
import {
  formatEuro,
  formatMoneyInput,
  formatNumberInput,
  parseGermanNumber,
  parseMoney,
} from "@/lib/engine/format";
import { BASISZINS_YEARS, basiszins } from "@/lib/engine/tax/basiszins";
import { FONDS_ARTEN, type FondsArt } from "@/lib/engine/tax/teilfreistellung";
import type { Kirchensteuer } from "@/lib/engine/tax/kapitalertragsteuer";
import { berechneVorabpauschale } from "@/lib/engine/tax/vorabpauschale";
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

export function VorabpauschaleRechner() {
  const [jahr, setJahr] = useState(String(BASISZINS_YEARS[BASISZINS_YEARS.length - 1]));
  const [fondsArt, setFondsArt] = useState<FondsArt>("aktienfonds");
  const [kirchensteuer, setKirchensteuer] = useState<Kirchensteuer>("keine");
  const [fields, setFields] = useState({
    wertJahresanfang: formatMoneyInput(50_000_00),
    wertJahresende: formatMoneyInput(54_000_00),
    ausschuettungen: formatMoneyInput(0),
    monateGehalten: formatNumberInput(12),
    sparerpauschbetragRest: formatMoneyInput(1_000_00),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const wertJahresanfang = parseMoney(fields.wertJahresanfang);
    const wertJahresende = parseMoney(fields.wertJahresende);
    const ausschuettungen = parseMoney(fields.ausschuettungen);
    const monateGehalten = parseGermanNumber(fields.monateGehalten);
    const sparerpauschbetragRest = parseMoney(fields.sparerpauschbetragRest);
    const range = {
      wertJahresanfang: outOfRange(wertJahresanfang, 0, MAX_MONEY),
      wertJahresende: outOfRange(wertJahresende, 0, MAX_MONEY),
      ausschuettungen: outOfRange(ausschuettungen, 0, MAX_MONEY),
      monateGehalten: outOfRange(monateGehalten, 0, 12),
      sparerpauschbetragRest: outOfRange(sparerpauschbetragRest, 0, MAX_MONEY),
    };
    return {
      values: {
        wertJahresanfang: wertJahresanfang ?? 0,
        wertJahresende: wertJahresende ?? 0,
        ausschuettungen: ausschuettungen ?? 0,
        monateGehalten: Math.round(monateGehalten ?? 12),
        sparerpauschbetragRest: sparerpauschbetragRest ?? 0,
      },
      range,
      invalid: {
        wertJahresanfang: wertJahresanfang === null || range.wertJahresanfang,
        wertJahresende: wertJahresende === null || range.wertJahresende,
        ausschuettungen: ausschuettungen === null || range.ausschuettungen,
        monateGehalten: monateGehalten === null || range.monateGehalten,
        sparerpauschbetragRest:
          sparerpauschbetragRest === null || range.sparerpauschbetragRest,
      },
    };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (params) => {
      const jahrParam = Number(params.get("j"));
      if (BASISZINS_YEARS.includes(jahrParam)) setJahr(String(jahrParam));
      const art = params.get("f");
      if (FONDS_ARTEN.some((f) => f.id === art)) setFondsArt(art as FondsArt);
      const kist = params.get("k");
      if (kist === "acht" || kist === "neun" || kist === "keine") {
        setKirchensteuer(kist);
      }
      setFields({
        wertJahresanfang: formatMoneyInput(readMoney(params, "a", 50_000_00, MAX_MONEY)),
        wertJahresende: formatMoneyInput(readMoney(params, "e", 54_000_00, MAX_MONEY)),
        ausschuettungen: formatMoneyInput(readMoney(params, "d", 0, MAX_MONEY)),
        monateGehalten: formatNumberInput(
          Math.round(readNumber(params, "m", 12, 0, 12)),
        ),
        sparerpauschbetragRest: formatMoneyInput(
          readMoney(params, "s", 1_000_00, MAX_MONEY),
        ),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("j", jahr);
      p.set("a", moneyParam(parsed.values.wertJahresanfang));
      p.set("e", moneyParam(parsed.values.wertJahresende));
      p.set("d", moneyParam(parsed.values.ausschuettungen));
      p.set("f", fondsArt);
      p.set("m", numberParam(parsed.values.monateGehalten));
      p.set("s", moneyParam(parsed.values.sparerpauschbetragRest));
      if (kirchensteuer !== "keine") p.set("k", kirchensteuer);
      return p;
    },
    !incomplete,
    // A stable key by value: an array literal here would be a new object on
    // every render and fire the write effect each time.
    `${jahr}|${fondsArt}|${kirchensteuer}|${JSON.stringify(parsed.values)}`,
  );

  const result = useMemo(
    () =>
      incomplete
        ? null
        : berechneVorabpauschale({
            jahr: Number(jahr),
            fondsArt,
            kirchensteuer,
            ...parsed.values,
          }),
    [incomplete, jahr, fondsArt, kirchensteuer, parsed.values],
  );

  const zins = basiszins(Number(jahr));

  return (
    <div className="calc-grid">
      <form
        className="card calc-form order-2 flex flex-col gap-4 p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <SelectField
          id="jahr"
          label="Steuerjahr"
          value={jahr}
          onChange={setJahr}
          options={BASISZINS_YEARS.map((y) => ({ value: String(y), label: String(y) }))}
          hint={
            zins === null
              ? undefined
              : `Basiszins ${formatNumberInput(zins * 100)} % laut BMF.`
          }
        />
        <NumberField
          id="wertJahresanfang"
          label="Wert am 1. Januar"
          suffix="€"
          value={fields.wertJahresanfang}
          onChange={set("wertJahresanfang")}
          invalid={parsed.invalid.wertJahresanfang}
          error="Bitte eine Zahl eingeben."
        />
        <NumberField
          id="wertJahresende"
          label="Wert am 31. Dezember"
          suffix="€"
          value={fields.wertJahresende}
          onChange={set("wertJahresende")}
          invalid={parsed.invalid.wertJahresende}
          error="Bitte eine Zahl eingeben."
        />
        <NumberField
          id="ausschuettungen"
          label="Ausschüttungen im Jahr"
          suffix="€"
          value={fields.ausschuettungen}
          onChange={set("ausschuettungen")}
          invalid={parsed.invalid.ausschuettungen}
          hint="Bei thesaurierenden Fonds 0."
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
          id="monateGehalten"
          label="Monate gehalten"
          suffix="Monate"
          value={fields.monateGehalten}
          onChange={set("monateGehalten")}
          invalid={parsed.invalid.monateGehalten}
          hint="Zwölftelung nach § 18 Abs. 2 InvStG."
          error={
            parsed.range.monateGehalten
              ? "Zwischen 0 und 12 Monaten."
              : "Bitte eine Zahl eingeben."
          }
        />
        <NumberField
          id="sparerpauschbetragRest"
          label="Sparerpauschbetrag übrig"
          suffix="€"
          value={fields.sparerpauschbetragRest}
          onChange={set("sparerpauschbetragRest")}
          invalid={parsed.invalid.sparerpauschbetragRest}
          hint="1.000 € pro Person, soweit noch nicht verbraucht."
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

      <div data-result-card
        className="card order-1 p-5">
        <p data-result-label className="text-sm font-medium text-muted">Steuer auf die Vorabpauschale</p>
        <p data-result-value className="mt-1.5 overflow-x-auto text-4xl sm:text-5xl leading-tight font-semibold tabular-nums tracking-tight">
          {result === null ? "—" : formatEuro(result.steuer.total)}
        </p>
        {result === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              wird im Januar {Number(jahr) + 1} vom Verrechnungskonto eingezogen
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Vorabpauschale</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(result.vorabpauschale)}
                </dd>
                <p className="text-xs text-muted">
                  gedeckelt auf den Wertzuwachs von{" "}
                  {formatEuro(result.wertzuwachs)}
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Nach Teilfreistellung</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(result.nachTeilfreistellung)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Steuerpflichtig</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(result.steuerpflichtig)}
                </dd>
                <p className="text-xs text-muted">
                  {formatEuro(result.sparerpauschbetragGenutzt)} Freibetrag
                  genutzt
                </p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={`${jahr}|${fondsArt}|${kirchensteuer}|${JSON.stringify(parsed.values)}`} />
          </>
        )}
      </div>

      {result === null ? null : (
        <div className="card table-scroll order-3">
          <table className="data-table w-full text-right text-sm tabular-nums">
            <caption className="border-b border-border bg-surface px-4 py-3 text-left font-medium">
              Rechenweg nach § 18 InvStG
            </caption>
            <tbody>
              {[
                ["Basisertrag (Wert × 0,7 × Basiszins)", result.basisertrag],
                ["Vorabpauschale nach Deckelung", result.vorabpauschale],
                ["nach Teilfreistellung", result.nachTeilfreistellung],
                ["steuerpflichtig", result.steuerpflichtig],
                ["Kapitalertragsteuer", result.steuer.kest],
                ["Solidaritätszuschlag", result.steuer.soli],
                ["Kirchensteuer", result.steuer.kist],
                ["Steuer gesamt", result.steuer.total],
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
