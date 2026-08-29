import { parseMoney } from "@/lib/engine/format";
import type { ContributionTiming } from "@/lib/engine/finance/zinseszins";

/**
 * Scenario state lives in the URL so a calculation can be shared, bookmarked
 * and reached with the back button. Keys are short because the resulting URL
 * is meant to be pasted into a chat window.
 */
/** Which quantity the calculator solves for. */
export type Mode = "endkapital" | "sparrate" | "dauer";

export interface Scenario {
  mode: Mode;
  /** Meaningful in "sparrate" and "dauer" mode: the capital to reach. */
  targetCapital: number;
  startCapital: number;
  monthlyContribution: number;
  annualReturn: number;
  years: number;
  annualInflation: number;
  contributionIncrease: number;
  timing: ContributionTiming;
}

export const defaultScenario: Scenario = {
  mode: "endkapital",
  targetCapital: 50_000_000,
  startCapital: 1_000_000,
  monthlyContribution: 25_000,
  annualReturn: 7,
  years: 20,
  annualInflation: 2,
  contributionIncrease: 0,
  timing: "end",
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Query values are machine-written by `scenarioToParams`, so they always use a
 * dot as the decimal point. They must NOT go through the German input parser,
 * which reads a dot before three digits as a thousands separator: `r=6.125`
 * would come back as 6125 and then clamp to the 100 % ceiling, turning a
 * shared 6,125 % scenario — or the author's own page reload — into a wildly
 * different answer.
 */
function parseParamNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Cents from a canonical `1234.56`, kept exact by reusing the cent parser. */
function parseParamMoney(raw: string): number | null {
  if (raw.trim() === "") return null;
  if (!/^[+-]?\d*\.?\d*$/.test(raw.trim())) return null;
  return parseMoney(raw.trim().replace(".", ","));
}

export function scenarioFromParams(params: URLSearchParams): Scenario {
  const money = (key: string, fallback: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const parsed = parseParamMoney(raw);
    return parsed === null ? fallback : clamp(parsed, 0, 100_000_000_00);
  };

  const rate = (key: string, fallback: number, max: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const parsed = parseParamNumber(raw);
    return parsed === null ? fallback : clamp(parsed, -100, max);
  };

  const timing = params.get("t");
  const mode = params.get("mode");

  return {
    mode:
      mode === "sparrate" || mode === "dauer" ? mode : defaultScenario.mode,
    targetCapital: money("z", defaultScenario.targetCapital),
    startCapital: money("k", defaultScenario.startCapital),
    monthlyContribution: money("m", defaultScenario.monthlyContribution),
    annualReturn: rate("r", defaultScenario.annualReturn, 100),
    years: Math.round(
      clamp(
        parseParamNumber(params.get("j") ?? "") ?? defaultScenario.years,
        1,
        80,
      ),
    ),
    annualInflation: rate("i", defaultScenario.annualInflation, 100),
    contributionIncrease: rate("d", defaultScenario.contributionIncrease, 100),
    timing: timing === "begin" ? "begin" : defaultScenario.timing,
  };
}

export function scenarioToParams(scenario: Scenario): URLSearchParams {
  const params = new URLSearchParams();
  if (scenario.mode !== defaultScenario.mode) {
    params.set("mode", scenario.mode);
    params.set("z", String(scenario.targetCapital / 100));
  }
  params.set("k", String(scenario.startCapital / 100));
  params.set("m", String(scenario.monthlyContribution / 100));
  params.set("r", String(scenario.annualReturn));
  params.set("j", String(scenario.years));
  params.set("i", String(scenario.annualInflation));
  if (scenario.contributionIncrease !== 0) {
    params.set("d", String(scenario.contributionIncrease));
  }
  if (scenario.timing !== defaultScenario.timing) {
    params.set("t", scenario.timing);
  }
  return params;
}
