"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import { SelectField } from "@/components/SelectField";
import {
  formatEuroWhole,
  formatMoneyInput,
  formatNumber,
  formatNumberInput,
  formatPercent,
  parseGermanNumber,
  parseMoney,
} from "@/lib/engine/format";
import {
  histogramm,
  MAX_JAHRE_GESAMT,
  pfadAmPerzentil,
  pfadDetail,
  simuliereMonteCarlo,
  type MonteCarloInput,
  type MonteCarloResult,
} from "@/lib/engine/finance/monte-carlo";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";
import type { SimulationRequest, SimulationResponse } from "./simulation.worker";
import { VerlaufDetail } from "./VerlaufDetail";

// Recharts stays out of the prerendered HTML, as on the Zinseszinsrechner.
const FanChart = dynamic(() => import("./FanChart"), {
  ssr: false,
  loading: () => <div className="h-72 w-full" aria-hidden />,
});
const Verteilung = dynamic(() => import("./Verteilung"), {
  ssr: false,
  loading: () => <div className="h-64 w-full" aria-hidden />,
});

const MAX_MONEY = 100_000_000_00;
const MAX_JAHRE = 60;
const MAX_SEED = 999_999;
const SIMULATIONEN = ["1000", "5000", "10000"] as const;
type Simulationen = (typeof SIMULATIONEN)[number];
type Ansicht = "nominal" | "real";

type Werte = Omit<MonteCarloInput, "simulationen" | "seed">;

const DEFAULTS: Werte = {
  startkapital: 10_000_00,
  sparrate: 500_00,
  dynamik: 0,
  ansparJahre: 25,
  rendite: 7,
  // Roughly what broad world-equity indices have shown; a bond mix is lower.
  volatilitaet: 15,
  kosten: 0.2,
  inflation: 2,
  zielkapital: 500_000_00,
  entnahme: 0,
  entnahmeJahre: 30,
};
const DEFAULT_SIMULATIONEN: Simulationen = "5000";
const DEFAULT_SEED = 1;

const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);
const notInteger = (v: number | null) => v !== null && !Number.isInteger(v);

type Fields = Record<keyof Werte, string>;

function fieldsFrom(w: Werte): Fields {
  return {
    startkapital: formatMoneyInput(w.startkapital),
    sparrate: formatMoneyInput(w.sparrate),
    dynamik: formatNumberInput(w.dynamik),
    ansparJahre: formatNumberInput(w.ansparJahre),
    rendite: formatNumberInput(w.rendite),
    volatilitaet: formatNumberInput(w.volatilitaet),
    kosten: formatNumberInput(w.kosten),
    inflation: formatNumberInput(w.inflation),
    zielkapital: formatMoneyInput(w.zielkapital),
    entnahme: formatMoneyInput(w.entnahme),
    entnahmeJahre: formatNumberInput(w.entnahmeJahre),
  };
}

const quote = (anteil: number) => formatPercent(anteil * 100, 0);

/** "nach 1 Jahr", "nach 14,5 Jahren" */
function nachJahren(jahre: number): string {
  const gerundet = Math.round(jahre * 2) / 2;
  return `nach ${formatNumber(gerundet, gerundet % 1 === 0 ? 0 : 1)} ${
    gerundet === 1 ? "Jahr" : "Jahren"
  }`;
}

/**
 * Run the simulation off the main thread, newest request wins.
 *
 * A few hundred milliseconds of simulation on every keystroke would freeze the
 * field being typed into, so the input is debounced and handed to a worker.
 * Answers to inputs that have since changed are dropped rather than shown.
 * Where no worker can be created the simulation runs inline, still debounced.
 */
function useSimulation(input: MonteCarloInput | null) {
  const workerRef = useRef<Worker | null>(null);
  const latest = useRef(0);
  const [antwort, setAntwort] = useState<{ key: string; result: MonteCarloResult } | null>(
    null,
  );
  const key = input === null ? null : JSON.stringify(input);
  const keysById = useRef(new Map<number, string>());
  // The request in flight, so a worker that dies with it does not leave the
  // page on "Rechnet …" for good.
  const offen = useRef<{ key: string; input: MonteCarloInput } | null>(null);

  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<SimulationResponse>) => {
        const { id, result } = event.data;
        const k = keysById.current.get(id);
        keysById.current.delete(id);
        if (id === latest.current && k !== undefined) {
          offen.current = null;
          setAntwort({ key: k, result });
        }
      };
      worker.onerror = () => {
        worker?.terminate();
        workerRef.current = null;
        const pending = offen.current;
        if (pending) {
          offen.current = null;
          setAntwort({ key: pending.key, result: simuliereMonteCarlo(pending.input) });
        }
      };
    } catch {
      worker = null;
    }
    workerRef.current = worker;
    return () => worker?.terminate();
  }, []);

  useEffect(() => {
    if (input === null || key === null) return;
    const timer = window.setTimeout(() => {
      const id = ++latest.current;
      const worker = workerRef.current;
      if (worker) {
        keysById.current.set(id, key);
        offen.current = { key, input };
        worker.postMessage({ id, input } satisfies SimulationRequest);
      } else {
        setAntwort({ key, result: simuliereMonteCarlo(input) });
      }
    }, 150);
    return () => window.clearTimeout(timer);
    // `key` captures every field of `input`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    result: antwort?.result ?? null,
    aktuell: antwort !== null && antwort.key === key,
  };
}

export function MonteCarloRechner() {
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(DEFAULTS));
  const [simulationen, setSimulationen] = useState<Simulationen>(DEFAULT_SIMULATIONEN);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [ansicht, setAnsicht] = useState<Ansicht>("nominal");
  // Which path the drill-down shows: 0 = worst outcome, 100 = best.
  const [perzentil, setPerzentil] = useState(50);
  const set = (k: keyof Fields) => (v: string) => setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const p = {
      startkapital: parseMoney(fields.startkapital),
      sparrate: parseMoney(fields.sparrate),
      dynamik: parseGermanNumber(fields.dynamik),
      ansparJahre: parseGermanNumber(fields.ansparJahre),
      rendite: parseGermanNumber(fields.rendite),
      volatilitaet: parseGermanNumber(fields.volatilitaet),
      kosten: parseGermanNumber(fields.kosten),
      inflation: parseGermanNumber(fields.inflation),
      zielkapital: parseMoney(fields.zielkapital),
      entnahme: parseMoney(fields.entnahme),
      entnahmeJahre: parseGermanNumber(fields.entnahmeJahre),
    };

    const mitEntnahme = (p.entnahme ?? 0) > 0;
    const range: Record<keyof Fields, boolean> = {
      startkapital: outOfRange(p.startkapital, 0, MAX_MONEY),
      sparrate: outOfRange(p.sparrate, 0, MAX_MONEY),
      dynamik: outOfRange(p.dynamik, 0, 20),
      ansparJahre: outOfRange(p.ansparJahre, 0, MAX_JAHRE) || notInteger(p.ansparJahre),
      rendite: outOfRange(p.rendite, -20, 30),
      volatilitaet: outOfRange(p.volatilitaet, 0, 60),
      kosten: outOfRange(p.kosten, 0, 5),
      inflation: outOfRange(p.inflation, -5, 20),
      zielkapital: outOfRange(p.zielkapital, 0, MAX_MONEY),
      entnahme: outOfRange(p.entnahme, 0, MAX_MONEY),
      entnahmeJahre:
        outOfRange(p.entnahmeJahre, 1, MAX_JAHRE) || notInteger(p.entnahmeJahre),
    };
    // Both phases together are capped; the engine would otherwise cut the end off.
    const zuLang =
      mitEntnahme &&
      p.ansparJahre !== null &&
      p.entnahmeJahre !== null &&
      p.ansparJahre + p.entnahmeJahre > MAX_JAHRE_GESAMT;

    // Something has to be simulated: at least one year of either phase.
    const ohneZeitraum = p.ansparJahre === 0 && !mitEntnahme;
    const invalid = Object.fromEntries(
      (Object.keys(p) as (keyof Fields)[]).map((k) => [k, p[k] === null || range[k]]),
    ) as Record<keyof Fields, boolean>;
    // The Entnahme-Dauer only matters with a withdrawal.
    if (!mitEntnahme) invalid.entnahmeJahre = false;
    if (ohneZeitraum) invalid.ansparJahre = true;
    if (zuLang) invalid.entnahmeJahre = true;

    const values = Object.fromEntries(
      (Object.keys(p) as (keyof Fields)[]).map((k) => [k, p[k] ?? DEFAULTS[k]]),
    ) as Werte;

    return { values, range, invalid, ohneZeitraum, zuLang, mitEntnahme };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);
  const v = parsed.values;

  useScenarioUrl(
    (p) => {
      setFields(
        fieldsFrom({
          startkapital: readMoney(p, "k", DEFAULTS.startkapital, MAX_MONEY),
          sparrate: readMoney(p, "s", DEFAULTS.sparrate, MAX_MONEY),
          dynamik: readNumber(p, "d", DEFAULTS.dynamik, 0, 20),
          ansparJahre: Math.round(readNumber(p, "j", DEFAULTS.ansparJahre, 0, MAX_JAHRE)),
          rendite: readNumber(p, "r", DEFAULTS.rendite, -20, 30),
          volatilitaet: readNumber(p, "v", DEFAULTS.volatilitaet, 0, 60),
          kosten: readNumber(p, "t", DEFAULTS.kosten, 0, 5),
          inflation: readNumber(p, "i", DEFAULTS.inflation, -5, 20),
          zielkapital: readMoney(p, "z", DEFAULTS.zielkapital, MAX_MONEY),
          entnahme: readMoney(p, "e", DEFAULTS.entnahme, MAX_MONEY),
          entnahmeJahre: Math.round(
            readNumber(p, "ej", DEFAULTS.entnahmeJahre, 1, MAX_JAHRE),
          ),
        }),
      );
      const n = p.get("n");
      if (n !== null && (SIMULATIONEN as readonly string[]).includes(n)) {
        setSimulationen(n as Simulationen);
      }
      setSeed(Math.round(readNumber(p, "seed", DEFAULT_SEED, 0, MAX_SEED)));
      if (p.get("ans") === "real") setAnsicht("real");
      setPerzentil(readNumber(p, "p", 50, 0, 100));
    },
    () => {
      const p = new URLSearchParams();
      p.set("k", moneyParam(v.startkapital));
      p.set("s", moneyParam(v.sparrate));
      p.set("d", numberParam(v.dynamik));
      p.set("j", numberParam(v.ansparJahre));
      p.set("r", numberParam(v.rendite));
      p.set("v", numberParam(v.volatilitaet));
      p.set("t", numberParam(v.kosten));
      p.set("i", numberParam(v.inflation));
      p.set("z", moneyParam(v.zielkapital));
      p.set("e", moneyParam(v.entnahme));
      p.set("ej", numberParam(v.entnahmeJahre));
      p.set("n", simulationen);
      p.set("seed", numberParam(seed));
      p.set("ans", ansicht);
      p.set("p", numberParam(perzentil));
      return p;
    },
    !incomplete,
    JSON.stringify([v, simulationen, seed, ansicht, perzentil]),
  );

  const input: MonteCarloInput | null = useMemo(
    () =>
      incomplete
        ? null
        : {
            ...v,
            entnahme: parsed.mitEntnahme ? v.entnahme : 0,
            simulationen: Number(simulationen),
            seed,
          },
    [incomplete, v, parsed.mitEntnahme, simulationen, seed],
  );

  const { result, aktuell } = useSimulation(input);
  const real = ansicht === "real";
  const zeige = (cents: number, deflator: number) =>
    formatEuroWhole(real ? Math.round(cents / deflator) : cents);

  const ende = result?.ansparEnde ?? null;
  const entnahme = result?.entnahme ?? null;
  const gesamtJahre = result ? result.jahre[result.jahre.length - 1].jahr : 0;
  const letztes = result ? result.jahre[result.jahre.length - 1] : null;

  const pfade = result?.pfade ?? null;
  const detail = useMemo(
    () => (pfade ? pfadDetail(pfade, pfadAmPerzentil(pfade, perzentil)) : null),
    [pfade, perzentil],
  );
  const ausgewaehlterRang = pfade
    ? Math.round((perzentil / 100) * (pfade.anzahl - 1))
    : 0;
  const verteilung = useMemo(
    () =>
      pfade && letztes ? histogramm(pfade, real ? 100 * letztes.deflator : 100) : null,
    [pfade, letztes, real],
  );
  // A bar click lands on a rank; two decimals map every rank of 10.000 paths
  // back to itself.
  const waehleRang = (rang: number) => {
    if (!pfade) return;
    setPerzentil(Math.round((rang / Math.max(pfade.anzahl - 1, 1)) * 10_000) / 100);
  };

  const headline = (() => {
    if (incomplete) return { label: "Ergebnis", value: "—" };
    if (!result || !ende) return { label: "Simulation", value: "Rechnet …" };
    if (entnahme) {
      return {
        label: `Das Geld reicht ${v.entnahmeJahre} Jahre lang in`,
        value: `${quote(entnahme.erfolgsQuote)} der Fälle`,
      };
    }
    return {
      label: `Median-Endkapital nach ${v.ansparJahre} ${v.ansparJahre === 1 ? "Jahr" : "Jahren"}`,
      value: zeige(ende.perzentile[50], ende.deflator),
    };
  })();

  return (
    <div className="calc-grid">
      <form
        className="card calc-form order-2 flex flex-col gap-4 p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="pb-1 text-sm font-medium">Ansparphase</legend>
          <NumberField id="startkapital" label="Startkapital" suffix="€"
            value={fields.startkapital} onChange={set("startkapital")}
            invalid={parsed.invalid.startkapital} error="Bitte eine Zahl eingeben." />
          <NumberField id="sparrate" label="Monatliche Sparrate" suffix="€"
            value={fields.sparrate} onChange={set("sparrate")}
            invalid={parsed.invalid.sparrate} error="Bitte eine Zahl eingeben." />
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="dynamik" label="Dynamik" suffix="% p. a."
              value={fields.dynamik} onChange={set("dynamik")}
              invalid={parsed.invalid.dynamik}
              error={parsed.range.dynamik ? "Zwischen 0 und 20 %." : "Bitte eine Zahl eingeben."} />
            <NumberField id="ansparJahre" label="Dauer" suffix="Jahre"
              value={fields.ansparJahre} onChange={set("ansparJahre")}
              invalid={parsed.invalid.ansparJahre}
              error={
                parsed.ohneZeitraum
                  ? "Ohne Entnahme mindestens 1 Jahr."
                  : parsed.range.ansparJahre
                    ? `Ganze Zahl von 0 bis ${MAX_JAHRE}.`
                    : "Bitte eine Zahl eingeben."
              } />
          </div>
          <NumberField id="zielkapital" label="Zielkapital" suffix="€"
            value={fields.zielkapital} onChange={set("zielkapital")}
            invalid={parsed.invalid.zielkapital}
            hint="Nominal am Ende der Ansparphase. 0 € = ohne Ziel."
            error="Bitte eine Zahl eingeben." />
        </fieldset>

        <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
          <legend className="pr-2 text-sm font-medium">Markt und Kosten</legend>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="rendite" label="Rendite" suffix="% p. a."
              value={fields.rendite} onChange={set("rendite")}
              invalid={parsed.invalid.rendite}
              error={parsed.range.rendite ? "Zwischen -20 und 30 %." : "Bitte eine Zahl eingeben."} />
            <NumberField id="volatilitaet" label="Volatilität" suffix="% p. a."
              value={fields.volatilitaet} onChange={set("volatilitaet")}
              invalid={parsed.invalid.volatilitaet}
              error={parsed.range.volatilitaet ? "Zwischen 0 und 60 %." : "Bitte eine Zahl eingeben."} />
          </div>
          <p className="-mt-1 text-xs leading-relaxed text-muted">
            Die Rendite ist der Median vor Kosten: Die Hälfte der Verläufe liegt
            darüber. Breite Aktien-ETFs werden oft mit 6 bis 8 % und 15 bis 20 %
            Schwankung angesetzt; Anleihen deutlich darunter.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="kosten" label="Kosten (TER)" suffix="% p. a."
              value={fields.kosten} onChange={set("kosten")}
              invalid={parsed.invalid.kosten}
              error={parsed.range.kosten ? "Zwischen 0 und 5 %." : "Bitte eine Zahl eingeben."} />
            <NumberField id="inflation" label="Inflation" suffix="% p. a."
              value={fields.inflation} onChange={set("inflation")}
              invalid={parsed.invalid.inflation}
              error={parsed.range.inflation ? "Zwischen -5 und 20 %." : "Bitte eine Zahl eingeben."} />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
          <legend className="pr-2 text-sm font-medium">Entnahmephase</legend>
          <NumberField id="entnahme" label="Monatliche Entnahme" suffix="€"
            value={fields.entnahme} onChange={set("entnahme")}
            invalid={parsed.invalid.entnahme}
            hint="In heutiger Kaufkraft, steigt jedes Jahr mit der Inflation. 0 € = ohne Entnahmephase."
            error="Bitte eine Zahl eingeben." />
          {parsed.mitEntnahme ? (
            <NumberField id="entnahmeJahre" label="Entnahme über" suffix="Jahre"
              value={fields.entnahmeJahre} onChange={set("entnahmeJahre")}
              invalid={parsed.invalid.entnahmeJahre}
              error={
                parsed.zuLang
                  ? `Anspar- und Entnahmephase zusammen höchstens ${MAX_JAHRE_GESAMT} Jahre.`
                  : parsed.range.entnahmeJahre
                    ? `Ganze Zahl von 1 bis ${MAX_JAHRE}.`
                    : "Bitte eine Zahl eingeben."
              } />
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
          <legend className="pr-2 text-sm font-medium">Simulation</legend>
          <SelectField id="simulationen" label="Anzahl Verläufe"
            value={simulationen} onChange={setSimulationen}
            options={SIMULATIONEN.map((n) => ({
              value: n,
              label: formatNumber(Number(n), 0),
            }))}
            hint="Mehr Verläufe glätten die Ränder, rechnen aber länger." />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium" id="ansicht-label">Beträge</span>
            <div className="segmented" role="radiogroup" aria-labelledby="ansicht-label">
              {(
                [
                  ["nominal", "Nominal"],
                  ["real", "Heutige Kaufkraft"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} data-active={ansicht === value} className="segmented-option">
                  <input type="radio" name="ansicht" value={value}
                    checked={ansicht === value} onChange={() => setAnsicht(value)}
                    className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Zufallsfolge Nr. {formatNumber(seed, 0)} — derselbe Link zeigt dieselben Verläufe.
            </p>
            <button type="button" className="btn btn-secondary"
              onClick={() => setSeed((s) => (s * 7919 + 104_729) % (MAX_SEED + 1))}>
              Neu würfeln
            </button>
          </div>
        </fieldset>
      </form>

      <div data-result-card className="card order-1 p-5" aria-busy={!incomplete && !aktuell}>
        <p data-result-label className="text-sm font-medium text-muted">{headline.label}</p>
        <p data-result-value
          className={`mt-1.5 overflow-x-auto text-4xl sm:text-5xl leading-tight font-semibold tracking-tight transition-opacity ${
            !incomplete && !aktuell && result ? "opacity-60" : ""
          }`}>
          {headline.value}
        </p>
        {incomplete ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : !result || !ende || !letztes ? null : (
          <div className={`transition-opacity ${aktuell ? "" : "opacity-60"}`}>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              {entnahme
                ? `${formatEuroWhole(v.entnahme)} im Monat in heutiger Kaufkraft — ${
                    v.ansparJahre > 0
                      ? `das sind nach ${v.ansparJahre} Jahren Ansparen anfangs ${formatEuroWhole(entnahme.ersteEntnahme)}, `
                      : ""
                  }jedes Jahr um ${formatPercent(v.inflation, 1)} erhöht. ${
                    entnahme.erschoepftP10Jahre === null
                      ? "Auch in den ungünstigsten zehn Prozent der Verläufe bleibt bis zum Ende Kapital übrig."
                      : `Im ungünstigsten Zehntel der Verläufe ist das Depot ${nachJahren(entnahme.erschoepftP10Jahre)} leer.`
                  }`
                : `In 80 % der ${formatNumber(Number(simulationen), 0)} Verläufe liegt das Endkapital zwischen ${zeige(
                    ende.perzentile[10],
                    ende.deflator,
                  )} und ${zeige(ende.perzentile[90], ende.deflator)}${real ? " (heutige Kaufkraft)" : ""}.`}
            </p>

            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))]">
              {v.ansparJahre > 0 ? (
                <>
                  <div>
                    <dt className="text-sm text-muted">Ungünstig (10 %)</dt>
                    <dd className="text-lg font-medium tabular-nums">
                      {zeige(ende.perzentile[10], ende.deflator)}
                    </dd>
                    <p className="text-xs text-muted">9 von 10 Verläufen liegen darüber</p>
                  </div>
                  <div>
                    <dt className="text-sm text-muted">
                      {entnahme ? "Median bei Rentenbeginn" : "Median"}
                    </dt>
                    <dd className="text-lg font-medium tabular-nums text-accent">
                      {zeige(ende.perzentile[50], ende.deflator)}
                    </dd>
                    <p className="text-xs text-muted">
                      eingezahlt {zeige(ende.eingezahlt, ende.deflator)}
                    </p>
                  </div>
                  <div>
                    <dt className="text-sm text-muted">Günstig (90 %)</dt>
                    <dd className="text-lg font-medium tabular-nums">
                      {zeige(ende.perzentile[90], ende.deflator)}
                    </dd>
                    <p className="text-xs text-muted">1 von 10 Verläufen liegt darüber</p>
                  </div>
                </>
              ) : null}
              {ende.zielQuote === null || v.ansparJahre === 0 ? null : (
                <div>
                  <dt className="text-sm text-muted">Ziel erreicht</dt>
                  <dd className="text-lg font-medium tabular-nums">{quote(ende.zielQuote)}</dd>
                  <p className="text-xs text-muted">
                    {formatEuroWhole(v.zielkapital)} nominal
                  </p>
                </div>
              )}
              {v.ansparJahre === 0 ? null : (
                <div>
                  <dt className="text-sm text-muted">Weniger als eingezahlt</dt>
                  <dd className="text-lg font-medium tabular-nums">{quote(ende.verlustQuote)}</dd>
                  <p className="text-xs text-muted">nominal, am Ende der Ansparphase</p>
                </div>
              )}
              {entnahme ? (
                <div>
                  <dt className="text-sm text-muted">Median am Ende</dt>
                  <dd className="text-lg font-medium tabular-nums">
                    {zeige(letztes.perzentile[50], letztes.deflator)}
                  </dd>
                  <p className="text-xs text-muted">nach {gesamtJahre} Jahren insgesamt</p>
                </div>
              ) : null}
            </dl>

            <CopyLinkButton scenarioKey={JSON.stringify([v, simulationen, seed, ansicht, perzentil])} />
          </div>
        )}
      </div>

      {incomplete || !result ? null : (
        <div className={`card order-3 p-5 transition-opacity ${aktuell ? "" : "opacity-60"}`}>
          <h2 className="font-medium">Bandbreite der Verläufe</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            {real ? "In heutiger Kaufkraft. " : ""}
            Das helle Band umfasst 90 % der Verläufe, das dunkle die mittlere Hälfte.
          </p>
          <FanChart jahre={result.jahre} real={real}
            entnahmeAb={entnahme && v.ansparJahre > 0 ? v.ansparJahre : null}
            pfad={detail?.salden ?? null}
            pfadName={
              perzentil <= 0 ? "Schlechtester Verlauf"
                : perzentil >= 100 ? "Bester Verlauf"
                  : `Verlauf am ${formatNumber(perzentil, perzentil % 1 === 0 ? 0 : 2)}. Perzentil`
            } />
        </div>
      )}

      {incomplete || !result || !verteilung || !letztes ? null : (
        <div className={`card order-4 p-5 transition-opacity ${aktuell ? "" : "opacity-60"}`}>
          <h2 className="font-medium">
            Verteilung des Endkapitals nach {letztes.jahr} {letztes.jahr === 1 ? "Jahr" : "Jahren"}
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            {real ? "In heutiger Kaufkraft. " : ""}
            Jeder Balken ist der Anteil der Verläufe, die in diesem Bereich enden
            {verteilung.leer > 0 ? "; der rote links die, deren Depot vorher leer war" : ""}.
            Ein Klick wählt einen dieser Verläufe zum Ansehen aus.
          </p>
          <Verteilung histogramm={verteilung} anzahl={result.pfade.anzahl}
            ausgewaehlterRang={ausgewaehlterRang} onWaehle={waehleRang} />
        </div>
      )}

      {incomplete || !result || !detail ? null : (
        <section
          aria-labelledby="verlauf-titel"
          className={`card order-5 p-5 transition-opacity ${aktuell ? "" : "opacity-60"}`}
        >
          <h2 id="verlauf-titel" className="font-medium">Einen Verlauf genauer ansehen</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Alle Verläufe sind nach ihrem Ergebnis geordnet. Wähle einen aus, um zu
            sehen, wie er zustande kam — er erscheint auch als Linie im Diagramm oben.
          </p>
          <VerlaufDetail detail={detail} jahre={result.jahre} real={real}
            ansparJahre={v.ansparJahre} mitEntnahme={entnahme !== null}
            anzahl={result.pfade.anzahl} perzentil={perzentil} onPerzentil={setPerzentil} />
        </section>
      )}

      {incomplete || !result ? null : (
        <div className={`card table-scroll order-6 transition-opacity ${aktuell ? "" : "opacity-60"}`}>
          <table className="data-table w-full min-w-xl text-right text-sm tabular-nums">
            <caption className="border-b border-border bg-surface px-4 py-3 text-left font-medium">
              Verteilung Jahr für Jahr{real ? " (heutige Kaufkraft)" : ""}
            </caption>
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Jahr</th>
                <th scope="col" className="px-4 py-2 font-medium">Eingezahlt</th>
                <th scope="col" className="px-4 py-2 font-medium">10 %</th>
                <th scope="col" className="px-4 py-2 font-medium">Median</th>
                <th scope="col" className="px-4 py-2 font-medium">90 %</th>
                {entnahme ? (
                  <th scope="col" className="px-4 py-2 font-medium">Noch Kapital</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {result.jahre.slice(1).map((j) => (
                <tr key={j.jahr} className="border-t border-border">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    {j.jahr}
                    {entnahme && j.phase === "entnahme" && j.jahr === v.ansparJahre + 1 ? (
                      <span className="ml-2 text-xs text-muted">Entnahme</span>
                    ) : null}
                  </th>
                  <td className="px-4 py-2 text-muted">{zeige(j.eingezahlt, j.deflator)}</td>
                  <td className="px-4 py-2">{zeige(j.perzentile[10], j.deflator)}</td>
                  <td className="px-4 py-2 font-medium">{zeige(j.perzentile[50], j.deflator)}</td>
                  <td className="px-4 py-2">{zeige(j.perzentile[90], j.deflator)}</td>
                  {entnahme ? (
                    <td className="px-4 py-2">{quote(j.nochKapital)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {incomplete ? null : (
        <div className="card order-7 p-5 text-sm leading-relaxed text-muted">
          <h2 className="mb-2 font-medium text-foreground">Wie simuliert wird</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>
              Jeder Verlauf zieht seine Monatsrenditen zufällig aus einer
              Lognormalverteilung, die über ein Jahr den eingegebenen Median und die
              eingegebene Schwankung ergibt. Ohne Volatilität ist jeder Verlauf genau der
              des{" "}
              <Link href="/zinseszins-rechner/" className="text-accent underline-offset-2 hover:underline">
                Zinseszinsrechners
              </Link>
              .
            </li>
            <li>
              Die Kosten (TER) mindern jeden Monat die Rendite. Steuern sind nicht
              berücksichtigt — was nach Vorabpauschale und Abgeltungssteuer bleibt,
              zeigt der Rechner{" "}
              <Link href="/etf-sparplan-nach-steuern/" className="text-accent underline-offset-2 hover:underline">
                ETF-Sparplan nach Steuern
              </Link>
              .
            </li>
            <li>
              Die Monate sind voneinander unabhängig. Echte Märkte haben dickere Ränder
              und längere Durststrecken; die ungünstigen Perzentile sind darum eher eine
              Untergrenze für das Risiko als eine Obergrenze.
            </li>
            <li>
              Die Entnahme folgt dem{" "}
              <Link href="/entnahmeplan-rechner/" className="text-accent underline-offset-2 hover:underline">
                Entnahmeplan-Rechner
              </Link>
              : erst die Monatsrendite, dann die Auszahlung. Gerade hier zählt die
              Reihenfolge — schlechte Jahre am Anfang der Entnahme wiegen schwerer als
              am Ende, auch wenn die Durchschnittsrendite gleich ist.
            </li>
            <li>
              Die Zufallsfolge steht im Link, damit ein geteiltes Szenario dieselben
              Zahlen zeigt. „Neu würfeln“ zieht eine andere — wie stark sich die Zahlen
              dabei ändern, zeigt, wie genau die gewählte Anzahl Verläufe ist.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
