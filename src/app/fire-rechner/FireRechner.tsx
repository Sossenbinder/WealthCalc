"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import { CheckIcon } from "@/components/icons";
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
  berechneFire,
  MAX_ALTER,
  type FireInput,
  type FireStufe,
  type StufenErgebnis,
} from "@/lib/engine/finance/fire";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULTS: FireInput = {
  vermoegen: 150_000_00,
  sparrate: 1_000_00,
  rendite: 5,
  // 4 % is the American rule of thumb; German sources tend to advise less for
  // a retirement that may run fifty years rather than thirty.
  entnahmerate: 3.5,
  alter: 35,
  ruhestandsalter: 65,
  nebeneinkommen: 12_000_00,
  ausgabenMinimum: 24_000_00,
  ausgabenWunsch: 36_000_00,
  ausgabenKomfort: 60_000_00,
};

const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

const STUFE: Record<FireStufe, { name: string; kurz: string }> = {
  coast: {
    name: "Coast FIRE",
    kurz: "Nichts mehr sparen — bis zum Ruhestand wächst das Vermögen allein auf den FIRE-Bedarf.",
  },
  barista: {
    name: "Barista FIRE",
    kurz: "Teilzeit reicht: Nebeneinkommen und Entnahme decken die Wunschausgaben.",
  },
  lean: {
    name: "Lean FIRE",
    kurz: "Die Entnahme allein deckt die Mindestausgaben.",
  },
  fire: {
    name: "FIRE",
    kurz: "Die Entnahme allein deckt die Wunschausgaben.",
  },
  fat: {
    name: "Fat FIRE",
    kurz: "Die Entnahme allein deckt die Komfortausgaben.",
  },
};

type Fields = Record<keyof FireInput, string>;

function fieldsFrom(input: FireInput): Fields {
  return {
    vermoegen: formatMoneyInput(input.vermoegen),
    sparrate: formatMoneyInput(input.sparrate),
    rendite: formatNumberInput(input.rendite),
    entnahmerate: formatNumberInput(input.entnahmerate),
    alter: formatNumberInput(input.alter),
    ruhestandsalter: formatNumberInput(input.ruhestandsalter),
    nebeneinkommen: formatMoneyInput(input.nebeneinkommen),
    ausgabenMinimum: formatMoneyInput(input.ausgabenMinimum),
    ausgabenWunsch: formatMoneyInput(input.ausgabenWunsch),
    ausgabenKomfort: formatMoneyInput(input.ausgabenKomfort),
  };
}

/** "in 7 Monaten", "mit 52 (in 17 Jahren)", "Nicht vor 100". */
function wann(s: StufenErgebnis): string {
  if (s.erreicht) return "Erreicht";
  if (s.monateBis === null) return `Nicht vor ${MAX_ALTER}`;
  if (s.monateBis < 24) {
    return `in ${s.monateBis} ${s.monateBis === 1 ? "Monat" : "Monaten"}`;
  }
  const jahre = Math.round(s.monateBis / 12);
  return `mit ${s.erreichtMitAlter} (in ${jahre} Jahren)`;
}

export function FireRechner() {
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(DEFAULTS));
  const set = (k: keyof Fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const vermoegen = parseMoney(fields.vermoegen);
    const sparrate = parseMoney(fields.sparrate);
    const rendite = parseGermanNumber(fields.rendite);
    const entnahmerate = parseGermanNumber(fields.entnahmerate);
    const alter = parseGermanNumber(fields.alter);
    const ruhestandsalter = parseGermanNumber(fields.ruhestandsalter);
    const nebeneinkommen = parseMoney(fields.nebeneinkommen);
    const ausgabenMinimum = parseMoney(fields.ausgabenMinimum);
    const ausgabenWunsch = parseMoney(fields.ausgabenWunsch);
    const ausgabenKomfort = parseMoney(fields.ausgabenKomfort);

    const range = {
      vermoegen: outOfRange(vermoegen, 0, MAX_MONEY),
      sparrate: outOfRange(sparrate, 0, MAX_MONEY),
      rendite: outOfRange(rendite, -50, 50),
      entnahmerate: outOfRange(entnahmerate, 0.1, 20),
      alter: outOfRange(alter, 1, MAX_ALTER - 1) || (alter !== null && !Number.isInteger(alter)),
      // The Ruhestand has to lie ahead, or Coast has no years to work with.
      ruhestandsalter:
        outOfRange(ruhestandsalter, 2, MAX_ALTER) ||
        (ruhestandsalter !== null && !Number.isInteger(ruhestandsalter)) ||
        (ruhestandsalter !== null && alter !== null && ruhestandsalter <= alter),
      nebeneinkommen: outOfRange(nebeneinkommen, 0, MAX_MONEY),
      // The three budgets are a ladder; a Lean budget above the Wunsch budget
      // would put the rungs in the wrong order and the result would say so
      // in a way nobody could make sense of.
      ausgabenMinimum:
        outOfRange(ausgabenMinimum, 1, MAX_MONEY) ||
        (ausgabenMinimum !== null && ausgabenWunsch !== null && ausgabenMinimum > ausgabenWunsch),
      ausgabenWunsch: outOfRange(ausgabenWunsch, 1, MAX_MONEY),
      ausgabenKomfort:
        outOfRange(ausgabenKomfort, 1, MAX_MONEY) ||
        (ausgabenKomfort !== null && ausgabenWunsch !== null && ausgabenKomfort < ausgabenWunsch),
    };

    const values: FireInput = {
      vermoegen: vermoegen ?? DEFAULTS.vermoegen,
      sparrate: sparrate ?? DEFAULTS.sparrate,
      rendite: rendite ?? DEFAULTS.rendite,
      entnahmerate: entnahmerate ?? DEFAULTS.entnahmerate,
      alter: alter ?? DEFAULTS.alter,
      ruhestandsalter: ruhestandsalter ?? DEFAULTS.ruhestandsalter,
      nebeneinkommen: nebeneinkommen ?? DEFAULTS.nebeneinkommen,
      ausgabenMinimum: ausgabenMinimum ?? DEFAULTS.ausgabenMinimum,
      ausgabenWunsch: ausgabenWunsch ?? DEFAULTS.ausgabenWunsch,
      ausgabenKomfort: ausgabenKomfort ?? DEFAULTS.ausgabenKomfort,
    };

    const invalid: Record<keyof Fields, boolean> = {
      vermoegen: vermoegen === null || range.vermoegen,
      sparrate: sparrate === null || range.sparrate,
      rendite: rendite === null || range.rendite,
      entnahmerate: entnahmerate === null || range.entnahmerate,
      alter: alter === null || range.alter,
      ruhestandsalter: ruhestandsalter === null || range.ruhestandsalter,
      nebeneinkommen: nebeneinkommen === null || range.nebeneinkommen,
      ausgabenMinimum: ausgabenMinimum === null || range.ausgabenMinimum,
      ausgabenWunsch: ausgabenWunsch === null || range.ausgabenWunsch,
      ausgabenKomfort: ausgabenKomfort === null || range.ausgabenKomfort,
    };

    return { values, range, invalid };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);
  const v = parsed.values;

  useScenarioUrl(
    (p) => {
      const alter = readNumber(p, "a", DEFAULTS.alter, 1, MAX_ALTER - 1);
      setFields(
        fieldsFrom({
          vermoegen: readMoney(p, "v", DEFAULTS.vermoegen, MAX_MONEY),
          sparrate: readMoney(p, "s", DEFAULTS.sparrate, MAX_MONEY),
          rendite: readNumber(p, "r", DEFAULTS.rendite, -50, 50),
          entnahmerate: readNumber(p, "e", DEFAULTS.entnahmerate, 0.1, 20),
          alter,
          ruhestandsalter: readNumber(p, "ra", DEFAULTS.ruhestandsalter, alter + 1, MAX_ALTER),
          nebeneinkommen: readMoney(p, "n", DEFAULTS.nebeneinkommen, MAX_MONEY),
          ausgabenMinimum: readMoney(p, "am", DEFAULTS.ausgabenMinimum, MAX_MONEY),
          ausgabenWunsch: readMoney(p, "aw", DEFAULTS.ausgabenWunsch, MAX_MONEY),
          ausgabenKomfort: readMoney(p, "ak", DEFAULTS.ausgabenKomfort, MAX_MONEY),
        }),
      );
    },
    () => {
      const p = new URLSearchParams();
      p.set("v", moneyParam(v.vermoegen));
      p.set("s", moneyParam(v.sparrate));
      p.set("r", numberParam(v.rendite));
      p.set("e", numberParam(v.entnahmerate));
      p.set("a", numberParam(v.alter));
      p.set("ra", numberParam(v.ruhestandsalter));
      p.set("n", moneyParam(v.nebeneinkommen));
      p.set("am", moneyParam(v.ausgabenMinimum));
      p.set("aw", moneyParam(v.ausgabenWunsch));
      p.set("ak", moneyParam(v.ausgabenKomfort));
      return p;
    },
    !incomplete,
    JSON.stringify(v),
  );

  const result = useMemo(
    () => (incomplete ? null : berechneFire(v)),
    [incomplete, v],
  );

  const fire = result?.stufen.find((s) => s.stufe === "fire") ?? null;
  const naechste = result?.stufen.find((s) => !s.erreicht) ?? null;
  const fireAnteil = result ? Math.min(v.vermoegen / result.fireBedarf, 1) : 0;

  const erklaerung = (() => {
    if (!result) return null;
    switch (result.stufe) {
      case null:
        return naechste === null || naechste.monateBis === null
          ? `Mit dieser Sparrate und Rendite ist keine Stufe vor ${MAX_ALTER} erreichbar.`
          : `Bis ${STUFE[naechste.stufe].name} fehlen noch ${formatEuro(
              naechste.bedarf - v.vermoegen,
            )} — bei gleicher Sparrate erreichst du sie ${wann(naechste)}.`;
      case "coast":
        return `Ohne einen weiteren Euro wächst dein Vermögen bis ${
          v.ruhestandsalter
        } auf ${formatEuro(result.vermoegenMitRuhestand)} — mehr als der FIRE-Bedarf von ${formatEuro(
          result.fireBedarf,
        )}.`;
      case "barista":
        return `Mit ${formatEuro(v.nebeneinkommen)} Nebeneinkommen im Jahr trägt dich dein Vermögen schon jetzt.`;
      case "lean":
        return `Dein Vermögen deckt die Mindestausgaben von ${formatEuro(
          v.ausgabenMinimum,
        )} im Jahr dauerhaft — die Wunschausgaben noch nicht.`;
      case "fire":
        return `Dein Vermögen deckt ${formatEuro(
          v.ausgabenWunsch,
        )} im Jahr dauerhaft. Arbeiten ist ab jetzt freiwillig.`;
      case "fat":
        return `Dein Vermögen trägt sogar ${formatEuro(v.ausgabenKomfort)} im Jahr.`;
    }
  })();

  return (
    <div className="calc-grid">
      <form
        className="card calc-form order-2 flex flex-col gap-4 p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField id="vermoegen" label="Investiertes Vermögen" suffix="€"
          value={fields.vermoegen} onChange={set("vermoegen")}
          invalid={parsed.invalid.vermoegen}
          hint="Depot, Tagesgeld, Renten — alles, wovon du entnehmen könntest."
          error="Bitte eine Zahl eingeben." />
        <NumberField id="sparrate" label="Monatliche Sparrate" suffix="€"
          value={fields.sparrate} onChange={set("sparrate")}
          invalid={parsed.invalid.sparrate} error="Bitte eine Zahl eingeben." />
        <NumberField id="rendite" label="Reale Rendite pro Jahr" suffix="%"
          value={fields.rendite} onChange={set("rendite")}
          invalid={parsed.invalid.rendite}
          hint="Nach Inflation und Kosten. 5 % entsprechen etwa 7 % nominal."
          error={parsed.range.rendite ? "Zwischen -50 und 50 %." : "Bitte eine Zahl eingeben."} />
        <NumberField id="entnahmerate" label="Entnahmerate" suffix="%"
          value={fields.entnahmerate} onChange={set("entnahmerate")}
          invalid={parsed.invalid.entnahmerate}
          hint="Die 4-%-Regel gilt für 30 Jahre; für länger sind 3 bis 3,5 % üblich."
          error={parsed.range.entnahmerate ? "Zwischen 0,1 und 20 %." : "Bitte eine Zahl eingeben."} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="alter" label="Dein Alter" suffix="Jahre"
            value={fields.alter} onChange={set("alter")}
            invalid={parsed.invalid.alter}
            error={parsed.range.alter ? `Ganze Zahl zwischen 1 und ${MAX_ALTER - 1}.` : "Bitte eine Zahl eingeben."} />
          <NumberField id="ruhestandsalter" label="Ruhestand ab" suffix="Jahre"
            value={fields.ruhestandsalter} onChange={set("ruhestandsalter")}
            invalid={parsed.invalid.ruhestandsalter}
            error={parsed.range.ruhestandsalter ? `Ganze Zahl über deinem Alter, höchstens ${MAX_ALTER}.` : "Bitte eine Zahl eingeben."} />
        </div>
        <NumberField id="nebeneinkommen" label="Nebeneinkommen im Jahr" suffix="€"
          value={fields.nebeneinkommen} onChange={set("nebeneinkommen")}
          invalid={parsed.invalid.nebeneinkommen}
          hint="Für Barista FIRE: was ein Teilzeitjob netto einbringen würde."
          error="Bitte eine Zahl eingeben." />

        <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
          <legend className="pr-2 text-sm font-medium">Ausgaben im Jahr</legend>
          <NumberField id="ausgabenMinimum" label="Minimum" suffix="€"
            value={fields.ausgabenMinimum} onChange={set("ausgabenMinimum")}
            invalid={parsed.invalid.ausgabenMinimum}
            hint="Für Lean FIRE: was du im knappsten Fall brauchst."
            error={parsed.range.ausgabenMinimum ? "Höchstens so viel wie die Wunschausgaben." : "Bitte eine Zahl eingeben."} />
          <NumberField id="ausgabenWunsch" label="Wunsch" suffix="€"
            value={fields.ausgabenWunsch} onChange={set("ausgabenWunsch")}
            invalid={parsed.invalid.ausgabenWunsch}
            hint="Für FIRE: so willst du eigentlich leben."
            error="Bitte eine Zahl eingeben." />
          <NumberField id="ausgabenKomfort" label="Komfort" suffix="€"
            value={fields.ausgabenKomfort} onChange={set("ausgabenKomfort")}
            invalid={parsed.invalid.ausgabenKomfort}
            hint="Für Fat FIRE: mit Reisen, Extras, Reserve."
            error={parsed.range.ausgabenKomfort ? "Mindestens so viel wie die Wunschausgaben." : "Bitte eine Zahl eingeben."} />
        </fieldset>
      </form>

      <div data-result-card className="card order-1 p-5">
        <p data-result-label className="text-sm font-medium text-muted">Deine Stufe heute</p>
        <p data-result-value className="mt-1.5 overflow-x-auto text-4xl sm:text-5xl leading-tight font-semibold tracking-tight">
          {incomplete
            ? "—"
            : result === null
              ? "Nicht berechenbar"
              : result.stufe === null
                ? "Noch in der Ansparphase"
                : STUFE[result.stufe].name}
        </p>
        {incomplete ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : result === null ? (
          <p className="mt-1 text-sm text-muted">
            Ohne Entnahmerate deckt kein Vermögen irgendeine Ausgabe.
          </p>
        ) : (
          <>
            <p className="mt-1 max-w-2xl text-sm text-muted">{erklaerung}</p>

            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">FIRE-Bedarf</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(result.fireBedarf)}
                </dd>
                <p className="text-xs text-muted">
                  {formatEuro(v.ausgabenWunsch)} bei {formatPercent(v.entnahmerate, 1)} Entnahme
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Fortschritt zu FIRE</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatPercent(fireAnteil * 100, 0)}
                </dd>
                <p className="text-xs text-muted">
                  {v.vermoegen >= result.fireBedarf
                    ? `${formatEuro(v.vermoegen - result.fireBedarf)} darüber`
                    : `noch ${formatEuro(result.fireBedarf - v.vermoegen)}`}
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Finanziell frei</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {fire === null
                    ? "—"
                    : fire.erreicht
                      ? "Jetzt"
                      : fire.erreichtMitAlter === null
                        ? `Nicht vor ${MAX_ALTER}`
                        : `mit ${fire.erreichtMitAlter}`}
                </dd>
                <p className="text-xs text-muted">
                  {fire === null || fire.erreicht || fire.monateBis === null
                    ? "bei gleicher Sparrate und Rendite"
                    : `${wann(fire)} bei gleicher Sparrate`}
                </p>
              </div>
            </dl>

            <CopyLinkButton scenarioKey={JSON.stringify(v)} />
          </>
        )}
      </div>

      {result === null || incomplete ? null : (
        <div className="card order-3 p-5">
          <h2 className="font-medium">Die fünf Stufen</h2>
          <p className="mt-1 text-sm text-muted">
            Jede Stufe ist eine eigene Bedingung an dein heutiges Vermögen — du
            kannst auf mehreren zugleich stehen.
          </p>
          <ol className="mt-5 flex flex-col gap-5">
            {result.stufen.map((s) => {
              const anteil =
                s.fortschritt === Infinity ? 1 : Math.min(s.fortschritt, 1);
              return (
                <li key={s.stufe} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="flex items-center gap-2 font-medium">
                      {s.erreicht ? (
                        <span
                          aria-hidden="true"
                          className="grid size-5 place-items-center rounded-full bg-accent text-accent-on"
                        >
                          <CheckIcon width={12} height={12} strokeWidth={2.5} />
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="size-5 rounded-full border-2 border-border-strong"
                        />
                      )}
                      {STUFE[s.stufe].name}
                    </span>
                    <span
                      className={`text-sm tabular-nums ${
                        s.erreicht ? "font-medium text-accent" : "text-muted"
                      }`}
                    >
                      {s.erreicht ? "Erreicht" : wann(s)}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${STUFE[s.stufe].name}: ${formatPercent(anteil * 100, 0)} des Bedarfs`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(anteil * 100)}
                    className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        s.erreicht ? "bg-accent" : "bg-border-strong"
                      }`}
                      style={{ width: `${anteil * 100}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-xs text-muted">
                    <span className="max-w-md">{STUFE[s.stufe].kurz}</span>
                    <span className="tabular-nums">
                      {s.bedarf === 0
                        ? "kein Kapital nötig"
                        : `${formatEuroWhole(Math.min(v.vermoegen, s.bedarf))} von ${formatEuroWhole(s.bedarf)}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {result === null || incomplete ? null : (
        <div className="card table-scroll order-4">
          <table className="data-table w-full text-right text-sm tabular-nums">
            <caption className="border-b border-border bg-surface px-4 py-3 text-left font-medium">
              Wie sich der Bedarf ergibt
            </caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Stufe</th>
                <th scope="col" className="px-4 py-2 font-medium">Ausgaben</th>
                <th scope="col" className="px-4 py-2 font-medium">abzüglich</th>
                <th scope="col" className="px-4 py-2 font-medium">Bedarf heute</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["lean", v.ausgabenMinimum, 0],
                  ["barista", v.ausgabenWunsch, v.nebeneinkommen],
                  ["fire", v.ausgabenWunsch, 0],
                  ["fat", v.ausgabenKomfort, 0],
                ] as const
              ).map(([stufe, ausgaben, abzug]) => (
                <tr key={stufe} className="border-t border-border">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {STUFE[stufe].name}
                  </th>
                  <td className="px-4 py-2">{formatEuroWhole(ausgaben)}</td>
                  <td className="px-4 py-2 text-muted">
                    {abzug === 0 ? "—" : formatEuroWhole(abzug)}
                  </td>
                  <td className="px-4 py-2 font-medium">
                    {formatEuroWhole(result.stufen.find((s) => s.stufe === stufe)!.bedarf)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <th scope="row" className="px-4 py-2 text-left font-normal">
                  Coast FIRE
                </th>
                <td className="px-4 py-2 text-muted" colSpan={2}>
                  FIRE-Bedarf, abgezinst über {v.ruhestandsalter - v.alter}{" "}
                  {v.ruhestandsalter - v.alter === 1 ? "Jahr" : "Jahre"} zu{" "}
                  {formatPercent(v.rendite, 1)}
                </td>
                <td className="px-4 py-2 font-medium">
                  {formatEuroWhole(result.stufen.find((s) => s.stufe === "coast")!.bedarf)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-3 text-xs text-muted">
            Bedarf = (Ausgaben − Nebeneinkommen) ÷ Entnahmerate. Alles in heutiger
            Kaufkraft: die Rendite ist real, die Ausgaben brauchen keine
            Anpassung an die Inflation.
          </p>
        </div>
      )}
    </div>
  );
}
