"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
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
  calculateSparplan,
  solveMonthlyContribution,
  solveYears,
  type ContributionTiming,
} from "@/lib/engine/finance/zinseszins";
import {
  defaultScenario,
  scenarioFromParams,
  scenarioToParams,
  type Mode,
  type Scenario,
} from "./scenario-url";

// Charting is decoration next to the table, and Recharts is heavy: keep it out
// of the prerendered HTML and load it once the page is interactive.
const GrowthChart = dynamic(() => import("@/components/GrowthChart"), {
  ssr: false,
  loading: () => <div className="h-72 w-full" aria-hidden />,
});

const MIN_YEARS = 1;
const MAX_YEARS = 80;

// These mirror the bounds `scenario-url.ts` applies when reading a link. The
// form has to reject what the URL layer would clamp: otherwise a value is
// accepted, calculated with, written to the URL — and then silently altered by
// the user's own reload.
const MIN_RATE = -100;
const MAX_RATE = 100;
const MAX_MONEY = 100_000_000_00;

const outOfRange = (value: number | null, min: number, max: number) =>
  value !== null && (value < min || value > max);

/** Field labels, reused by the form and by the "what is missing" message. */
const FIELD_LABELS: Record<keyof Fields, string> = {
  startCapital: "Einmalanlage",
  monthlyContribution: "Monatliche Sparrate",
  targetCapital: "Zielkapital",
  annualReturn: "Rendite pro Jahr",
  years: "Anlagedauer",
  annualInflation: "Inflation pro Jahr",
  contributionIncrease: "Dynamik pro Jahr",
};

/** Render a number for an editable field, preserving the precision entered. */
function numberInput(value: number): string {
  return formatNumberInput(value);
}

interface Fields {
  startCapital: string;
  monthlyContribution: string;
  targetCapital: string;
  annualReturn: string;
  years: string;
  annualInflation: string;
  contributionIncrease: string;
}

function fieldsFromScenario(scenario: Scenario): Fields {
  return {
    startCapital: formatMoneyInput(scenario.startCapital),
    monthlyContribution: formatMoneyInput(scenario.monthlyContribution),
    targetCapital: formatMoneyInput(scenario.targetCapital),
    annualReturn: numberInput(scenario.annualReturn),
    years: numberInput(scenario.years),
    annualInflation: numberInput(scenario.annualInflation),
    contributionIncrease: numberInput(scenario.contributionIncrease),
  };
}

export function ZinseszinsCalculator() {
  const [fields, setFields] = useState<Fields>(() =>
    fieldsFromScenario(defaultScenario),
  );
  const [timing, setTiming] = useState<ContributionTiming>(
    defaultScenario.timing,
  );
  const [mode, setMode] = useState<Mode>(defaultScenario.mode);
  const [urlApplied, setUrlApplied] = useState(false);

  // The page is statically exported, so the URL is read on the client after
  // hydration rather than from server-side searchParams.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length > 0) {
      const scenario = scenarioFromParams(params);
      setFields(fieldsFromScenario(scenario));
      setTiming(scenario.timing);
      setMode(scenario.mode);
    }
    setUrlApplied(true);
  }, []);

  const parsed = useMemo(() => {
    const startCapital = parseMoney(fields.startCapital);
    const monthlyContribution = parseMoney(fields.monthlyContribution);
    const targetCapital = parseMoney(fields.targetCapital);
    const annualReturn = parseGermanNumber(fields.annualReturn);
    const years = parseGermanNumber(fields.years);
    const yearsOutOfRange = outOfRange(years, MIN_YEARS, MAX_YEARS);
    const annualInflation = parseGermanNumber(fields.annualInflation);
    const contributionIncrease = parseGermanNumber(fields.contributionIncrease);

    const rangeErrors = {
      startCapital: outOfRange(startCapital, 0, MAX_MONEY),
      monthlyContribution: outOfRange(monthlyContribution, 0, MAX_MONEY),
      targetCapital: outOfRange(targetCapital, 0, MAX_MONEY),
      annualReturn: outOfRange(annualReturn, MIN_RATE, MAX_RATE),
      years: yearsOutOfRange,
      annualInflation: outOfRange(annualInflation, MIN_RATE, MAX_RATE),
      contributionIncrease: outOfRange(
        contributionIncrease,
        MIN_RATE,
        MAX_RATE,
      ),
    };

    const scenario: Scenario = {
      mode,
      targetCapital: targetCapital ?? defaultScenario.targetCapital,
      startCapital: startCapital ?? defaultScenario.startCapital,
      monthlyContribution:
        monthlyContribution ?? defaultScenario.monthlyContribution,
      annualReturn: annualReturn ?? defaultScenario.annualReturn,
      years: Math.min(Math.max(Math.round(years ?? defaultScenario.years), 1), 80),
      annualInflation: annualInflation ?? defaultScenario.annualInflation,
      contributionIncrease:
        contributionIncrease ?? defaultScenario.contributionIncrease,
      timing,
    };

    return {
      scenario,
      rangeErrors,
      invalid: {
        startCapital: startCapital === null || rangeErrors.startCapital,
        monthlyContribution:
          monthlyContribution === null || rangeErrors.monthlyContribution,
        targetCapital: targetCapital === null || rangeErrors.targetCapital,
        annualReturn: annualReturn === null || rangeErrors.annualReturn,
        years: years === null || rangeErrors.years,
        annualInflation:
          annualInflation === null || rangeErrors.annualInflation,
        contributionIncrease:
          contributionIncrease === null || rangeErrors.contributionIncrease,
      },
    };
  }, [fields, timing, mode]);

  // A field that is empty or unreadable must not quietly fall back to a
  // default: the result would be a confident figure derived from a number the
  // user never entered and cannot see. Work out what is missing, and say so
  // instead of answering.
  const missingFields = (Object.keys(FIELD_LABELS) as (keyof Fields)[]).filter(
    (key) => {
      if (!parsed.invalid[key]) return false;
      if (key === "targetCapital") return mode !== "endkapital";
      if (key === "monthlyContribution") return mode !== "sparrate";
      if (key === "years") return mode !== "dauer";
      return true;
    },
  );
  const incomplete = missingFields.length > 0;
  const missingLabel = new Intl.ListFormat("de-DE", {
    style: "long",
    type: "conjunction",
  }).format(missingFields.map((key) => FIELD_LABELS[key]));

  // In "sparrate" mode the monthly contribution is an output, not an input:
  // solve for it first, then run the ordinary projection with the answer so
  // the summary and the table below it describe the very same plan.
  const solvedContribution = useMemo(() => {
    if (parsed.scenario.mode !== "sparrate") return null;
    return solveMonthlyContribution(
      parsed.scenario,
      parsed.scenario.targetCapital,
    );
  }, [parsed.scenario]);

  const solvedYears = useMemo(() => {
    if (parsed.scenario.mode !== "dauer") return null;
    return solveYears(
      parsed.scenario,
      parsed.scenario.targetCapital,
      MAX_YEARS,
    );
  }, [parsed.scenario]);

  const effectiveScenario = useMemo(
    () =>
      parsed.scenario.mode === "sparrate"
        ? { ...parsed.scenario, monthlyContribution: solvedContribution ?? 0 }
        : parsed.scenario.mode === "dauer"
          ? { ...parsed.scenario, years: Math.max(solvedYears ?? 0, 1) }
          : parsed.scenario,
    [parsed.scenario, solvedContribution, solvedYears],
  );

  const result = useMemo(
    () => calculateSparplan(effectiveScenario),
    [effectiveScenario],
  );

  // Keep the address bar in step so the scenario can be copied and shared.
  //
  // Gated on urlApplied: on mount this effect would otherwise run before the
  // effect above has applied the incoming query string, overwrite it with the
  // defaults, and leave a shared link silently showing the wrong scenario.
  useEffect(() => {
    if (!urlApplied || incomplete) return;
    const params = scenarioToParams(parsed.scenario);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [urlApplied, incomplete, parsed.scenario]);

  // Having answered "what would I need to save?", the obvious next question is
  // "and how does that plan look?" — so hand the solved rate over to the other
  // mode rather than making the reader copy it across by hand. Explicit rather
  // than automatic on every mode switch, which would overwrite the rate they
  // came in with.
  const continueWithSolvedRate = () => {
    if (solvedContribution === null) return;
    setFields((current) => ({
      ...current,
      monthlyContribution: formatMoneyInput(solvedContribution),
    }));
    setMode("endkapital");
  };

  /** The same hand-over for the horizon Dauer mode solves for. */
  const continueWithSolvedYears = () => {
    if (solvedYears === null || solvedYears === 0) return;
    setFields((current) => ({
      ...current,
      years: numberInput(solvedYears),
    }));
    setMode("endkapital");
  };

  const set = (key: keyof Fields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const interestShare =
    result.finalBalance > 0 ? result.totalInterest / result.finalBalance : 0;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(event) => event.preventDefault()}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Ich möchte berechnen</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))]">
            {(
              [
                ["endkapital", "Endkapital"],
                ["sparrate", "Sparrate"],
                ["dauer", "Dauer"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm has-[:focus-visible]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40 ${
                  mode === value
                    ? "border-accent bg-accent-soft font-medium"
                    : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <NumberField
          id="startCapital"
          label="Einmalanlage"
          suffix="€"
          value={fields.startCapital}
          onChange={set("startCapital")}
          invalid={parsed.invalid.startCapital}
          error={
            parsed.rangeErrors.startCapital
              ? `Zwischen 0 und ${formatMoneyInput(MAX_MONEY)} €.`
              : "Bitte eine Zahl eingeben."
          }
        />
        {mode !== "endkapital" ? (
          <NumberField
            id="targetCapital"
            label="Zielkapital"
            suffix="€"
            value={fields.targetCapital}
            onChange={set("targetCapital")}
            invalid={parsed.invalid.targetCapital}
            hint="Betrag, den du am Ende erreichen willst."
            error={
              parsed.rangeErrors.targetCapital
                ? `Zwischen 0 und ${formatMoneyInput(MAX_MONEY)} €.`
                : "Bitte eine Zahl eingeben."
            }
          />
        ) : null}
        {mode !== "sparrate" ? (
          <NumberField
            id="monthlyContribution"
            label="Monatliche Sparrate"
            suffix="€"
            value={fields.monthlyContribution}
            onChange={set("monthlyContribution")}
            invalid={parsed.invalid.monthlyContribution}
            error={
              parsed.rangeErrors.monthlyContribution
                ? `Zwischen 0 und ${formatMoneyInput(MAX_MONEY)} €.`
                : "Bitte eine Zahl eingeben."
            }
          />
        ) : null}
        <NumberField
          id="annualReturn"
          label="Rendite pro Jahr"
          suffix="%"
          value={fields.annualReturn}
          onChange={set("annualReturn")}
          invalid={parsed.invalid.annualReturn}
          hint="Effektive Jahresrendite nach Kosten."
          error={
            parsed.rangeErrors.annualReturn
              ? `Zwischen ${MIN_RATE} und ${MAX_RATE} %.`
              : "Bitte eine Zahl eingeben."
          }
        />
        {mode === "dauer" ? null : (
        <NumberField
          id="years"
          label="Anlagedauer"
          suffix="Jahre"
          value={fields.years}
          onChange={set("years")}
          invalid={parsed.invalid.years}
          error={
            parsed.rangeErrors.years
              ? `Zwischen ${MIN_YEARS} und ${MAX_YEARS} Jahren.`
              : "Bitte eine Zahl eingeben."
          }
        />
        )}
        <NumberField
          id="annualInflation"
          label="Inflation pro Jahr"
          suffix="%"
          value={fields.annualInflation}
          onChange={set("annualInflation")}
          invalid={parsed.invalid.annualInflation}
          hint="Für die Spalte „real“ — 0 blendet die Inflation aus."
          error={
            parsed.rangeErrors.annualInflation
              ? `Zwischen ${MIN_RATE} und ${MAX_RATE} %.`
              : "Bitte eine Zahl eingeben."
          }
        />
        <NumberField
          id="contributionIncrease"
          label="Dynamik pro Jahr"
          suffix="%"
          value={fields.contributionIncrease}
          onChange={set("contributionIncrease")}
          invalid={parsed.invalid.contributionIncrease}
          hint="Jährliche Erhöhung der Sparrate."
          error={
            parsed.rangeErrors.contributionIncrease
              ? `Zwischen ${MIN_RATE} und ${MAX_RATE} %.`
              : "Bitte eine Zahl eingeben."
          }
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Einzahlung</legend>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))]">
            {(
              [
                ["end", "Monatsende"],
                ["begin", "Monatsanfang"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm has-[:focus-visible]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40 ${
                  timing === value
                    ? "border-accent bg-accent-soft font-medium"
                    : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="timing"
                  value={value}
                  checked={timing === value}
                  onChange={() => setTiming(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </form>

      <div className="order-1 rounded-xl border border-border bg-surface p-5 lg:col-start-2 lg:row-start-1">
        <p className="text-sm text-muted">
          {mode === "sparrate"
            ? "Benötigte monatliche Sparrate"
            : mode === "dauer"
              ? "Benötigte Anlagedauer"
              : incomplete
                ? "Endkapital"
                : `Endkapital nach ${parsed.scenario.years} ${
                    parsed.scenario.years === 1 ? "Jahr" : "Jahren"
                  }`}
        </p>
        <p
          // A currency amount has no break opportunity — digits cannot wrap and
          // the space before € is non-breaking — so at large text sizes it
          // widens the whole page. Shrinking it to fit would mean rendering the
          // headline smaller than the body text of someone who asked for bigger
          // text, so let it scroll inside its own box, as the table does.
          // leading-tight: text-4xl pins line-height below the glyph box, which
          // a scroll container would then clip.
          className={`mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight ${
            incomplete ? "text-muted" : ""
          }`}
        >
          {incomplete
            ? "—"
            : mode === "sparrate"
              ? solvedContribution === null
                ? "Nicht erreichbar"
                : formatEuro(solvedContribution)
              : mode === "dauer"
                ? solvedYears === null
                  ? "Nicht erreichbar"
                  : solvedYears === 0
                    ? "Bereits erreicht"
                    : `${solvedYears} ${solvedYears === 1 ? "Jahr" : "Jahre"}`
                : formatEuro(result.finalBalance)}
        </p>
        {incomplete ? (
          <p className="mt-1 text-sm text-muted">
            Bitte {missingLabel} prüfen.
          </p>
        ) : mode === "dauer" ? (
          <p className="mt-1 text-sm text-muted">
            {solvedYears === null
              ? `Mit diesen Annahmen ist das Ziel in ${MAX_YEARS} Jahren nicht erreichbar.`
              : solvedYears === 0
                ? "Die Einmalanlage deckt das Ziel bereits ab."
                : `erreicht ${formatEuro(result.finalBalance)} — Ziel waren ${formatEuro(parsed.scenario.targetCapital)}`}
          </p>
        ) : mode === "sparrate" ? (
          <p className="mt-1 text-sm text-muted">
            {solvedContribution === null
              ? "Mit diesen Annahmen lässt sich das Ziel nicht erreichen."
              : `erreicht ${formatEuro(result.finalBalance)} nach ${
                  parsed.scenario.years
                } ${parsed.scenario.years === 1 ? "Jahr" : "Jahren"}`}
          </p>
        ) : null}

        {/* auto-fit rather than a viewport breakpoint: at large text sizes a
            fixed three-column grid squeezes each column below the width a
            currency string needs, and "108.957,84 €" cannot wrap, so the page
            gains a horizontal scrollbar. */}
        {incomplete ? null : (
        <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
          <div>
            <dt className="text-sm text-muted">Eingezahlt</dt>
            <dd className="text-lg font-medium tabular-nums">
              {formatEuro(result.totalPaidIn)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Zinsertrag</dt>
            <dd className="text-lg font-medium tabular-nums text-accent">
              {formatEuro(result.totalInterest)}
            </dd>
            <p className="text-xs text-muted">
              {formatPercent(interestShare * 100, 1)} des Endkapitals
            </p>
          </div>
          <div>
            <dt className="text-sm text-muted">Kaufkraft heute</dt>
            <dd className="text-lg font-medium tabular-nums">
              {formatEuro(result.realFinalBalance)}
            </dd>
            <p className="text-xs text-muted">
              bei {formatPercent(parsed.scenario.annualInflation, 1)} Inflation
            </p>
          </div>
        </dl>
        )}

        {incomplete || parsed.scenario.contributionIncrease === 0 ? null : (
          <p className="mt-4 text-sm text-muted">
            Sparrate steigt von{" "}
            <span className="font-medium text-foreground">
              {formatEuro(effectiveScenario.monthlyContribution)}
            </span>{" "}
            auf{" "}
            <span className="font-medium text-foreground">
              {formatEuro(result.finalMonthlyContribution)}
            </span>{" "}
            im Monat.
          </p>
        )}

        {incomplete ? null : (
          <CopyLinkButton
            scenarioKey={`${mode}|${JSON.stringify(parsed.scenario)}`}
          >
  {mode === "sparrate" && solvedContribution !== null ? (
                <button
                  type="button"
                  onClick={continueWithSolvedRate}
                  className="rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm font-medium hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  Mit dieser Rate weiterrechnen
                </button>
              ) : mode === "dauer" && solvedYears !== null && solvedYears > 0 ? (
                <button
                  type="button"
                  onClick={continueWithSolvedYears}
                  className="rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm font-medium hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  Mit dieser Dauer weiterrechnen
                </button>
              ) : null}
          </CopyLinkButton>
        )}
      </div>

      {incomplete ? null : (
      <div className="order-3 rounded-xl border border-border bg-surface p-5 lg:col-start-2 lg:row-start-2">
        <h2 className="mb-4 font-medium">Eingezahlt und Zinsertrag</h2>
        <GrowthChart years={result.years} />
      </div>
      )}

      {incomplete ? null : (
      <div className="order-4 overflow-x-auto rounded-xl border border-border bg-surface lg:col-start-2 lg:row-start-3">
        <table className="w-full min-w-xl text-right text-sm tabular-nums">
          <caption className="border-b border-border px-4 py-3 text-left font-medium">
            Entwicklung Jahr für Jahr
          </caption>
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium">
                Jahr
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Einzahlung
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Zinsen
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Eingezahlt gesamt
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Endkapital
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                davon real
              </th>
            </tr>
          </thead>
          <tbody>
            {result.years.map((row) => (
              <tr key={row.year} className="border-t border-border">
                <th scope="row" className="px-4 py-2 text-left font-normal">
                  {row.year}
                </th>
                <td className="px-4 py-2">{formatEuroWhole(row.contributions)}</td>
                <td className="px-4 py-2 text-accent">
                  {formatEuroWhole(row.interest)}
                </td>
                <td className="px-4 py-2 text-muted">
                  {formatEuroWhole(row.totalPaidIn)}
                </td>
                <td className="px-4 py-2 font-medium">
                  {formatEuroWhole(row.closingBalance)}
                </td>
                <td className="px-4 py-2 text-muted">
                  {formatEuroWhole(row.realClosingBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
