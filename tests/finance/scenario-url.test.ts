import { describe, expect, it } from "vitest";
import {
  defaultScenario,
  scenarioFromParams,
  scenarioToParams,
  type Scenario,
} from "@/app/zinseszins-rechner/scenario-url";

const scenario: Scenario = {
  mode: "sparrate",
  targetCapital: 50_000_000,
  startCapital: 500_000,
  monthlyContribution: 40_000,
  annualReturn: 6.5,
  years: 25,
  annualInflation: 2,
  contributionIncrease: 3,
  timing: "begin",
};

describe("scenario URL round-trip", () => {
  it("survives a full encode/decode cycle", () => {
    expect(scenarioFromParams(scenarioToParams(scenario))).toEqual(scenario);
  });

  it("reads a link written by another visitor", () => {
    const params = new URLSearchParams("k=5000&m=400&r=6.5&j=25&i=2");
    expect(scenarioFromParams(params)).toEqual({
      mode: "endkapital",
      targetCapital: defaultScenario.targetCapital,
      startCapital: 500_000,
      monthlyContribution: 40_000,
      annualReturn: 6.5,
      years: 25,
      annualInflation: 2,
      contributionIncrease: 0,
      timing: "end",
    });
  });

  it("falls back to the default for anything missing or unreadable", () => {
    expect(scenarioFromParams(new URLSearchParams(""))).toEqual(defaultScenario);
    expect(scenarioFromParams(new URLSearchParams("k=abc&j=nope"))).toEqual(
      defaultScenario,
    );
  });

  it("clamps a hostile horizon instead of freezing the browser", () => {
    expect(scenarioFromParams(new URLSearchParams("j=99999")).years).toBe(80);
    expect(scenarioFromParams(new URLSearchParams("j=-5")).years).toBe(1);
  });
});

describe("query values are read as machine-written, not as German input", () => {
  it("keeps a three-decimal rate instead of reading the dot as thousands", () => {
    // Regression: `r=6.125` went through the German input parser, which reads a
    // dot before three digits as a thousands separator, giving 6125 — then
    // clamped to the 100 % ceiling. A 6,125 % plan came back as 100 %.
    expect(scenarioFromParams(new URLSearchParams("r=6.125")).annualReturn).toBe(
      6.125,
    );
    expect(
      scenarioFromParams(new URLSearchParams("i=1.375")).annualInflation,
    ).toBe(1.375);
    expect(
      scenarioFromParams(new URLSearchParams("d=2.500")).contributionIncrease,
    ).toBe(2.5);
  });

  it("round-trips a three-decimal rate through the URL", () => {
    const scenario = { ...defaultScenario, annualReturn: 6.125 };
    expect(scenarioFromParams(scenarioToParams(scenario))).toEqual(scenario);
  });

  it("reads canonical money amounts exactly", () => {
    expect(scenarioFromParams(new URLSearchParams("k=1234.56")).startCapital).toBe(
      123_456,
    );
    expect(scenarioFromParams(new URLSearchParams("k=5000")).startCapital).toBe(
      500_000,
    );
    // A dot here is a decimal point, never a thousands grouping.
    expect(scenarioFromParams(new URLSearchParams("k=5.000")).startCapital).toBe(
      500,
    );
  });

  it("still rejects values that are not numbers", () => {
    expect(scenarioFromParams(new URLSearchParams("r=abc")).annualReturn).toBe(
      defaultScenario.annualReturn,
    );
    expect(scenarioFromParams(new URLSearchParams("k=abc")).startCapital).toBe(
      defaultScenario.startCapital,
    );
  });
});

describe("the third mode", () => {
  it("reads and writes the Dauer mode", () => {
    expect(scenarioFromParams(new URLSearchParams("mode=dauer&z=100000")).mode).toBe(
      "dauer",
    );
    const params = scenarioToParams({ ...defaultScenario, mode: "dauer" });
    expect(params.get("mode")).toBe("dauer");
  });

  it("falls back to the default for a mode it does not know", () => {
    expect(scenarioFromParams(new URLSearchParams("mode=quatsch")).mode).toBe(
      defaultScenario.mode,
    );
  });
});
