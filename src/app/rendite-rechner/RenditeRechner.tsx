"use client";

import { useMemo, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { NumberField } from "@/components/NumberField";
import {
  formatEuro,
  formatMoneyInput,
  formatNumberInput,
  formatPercent,
  parseGermanNumber,
  parseMoney,
} from "@/lib/engine/format";
import { berechneRendite, UNERREICHBAR } from "@/lib/engine/finance/rendite";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULTS = {
  startkapital: 10_000_00,
  // A plausible, positive default: 10.000 € plus 200 €/Monat over ten years is
  // 34.000 € paid in, so the landing example should sit clearly above that.
  endkapital: 45_000_00,
  monatlicheEinzahlung: 200_00,
  jahre: 10,
};
const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

export function RenditeRechner() {
  const [fields, setFields] = useState({
    startkapital: formatMoneyInput(DEFAULTS.startkapital),
    endkapital: formatMoneyInput(DEFAULTS.endkapital),
    monatlicheEinzahlung: formatMoneyInput(DEFAULTS.monatlicheEinzahlung),
    jahre: formatNumberInput(DEFAULTS.jahre),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const startkapital = parseMoney(fields.startkapital);
    const endkapital = parseMoney(fields.endkapital);
    const monatlicheEinzahlung = parseMoney(fields.monatlicheEinzahlung);
    const jahre = parseGermanNumber(fields.jahre);
    const range = {
      startkapital: outOfRange(startkapital, 0, MAX_MONEY),
      endkapital: outOfRange(endkapital, 0, MAX_MONEY),
      monatlicheEinzahlung: outOfRange(monatlicheEinzahlung, 0, MAX_MONEY),
      jahre: outOfRange(jahre, 1, 80),
    };
    return {
      values: {
        startkapital: startkapital ?? DEFAULTS.startkapital,
        endkapital: endkapital ?? DEFAULTS.endkapital,
        monatlicheEinzahlung:
          monatlicheEinzahlung ?? DEFAULTS.monatlicheEinzahlung,
        jahre: Math.round(jahre ?? DEFAULTS.jahre),
      },
      range,
      invalid: {
        startkapital: startkapital === null || range.startkapital,
        endkapital: endkapital === null || range.endkapital,
        monatlicheEinzahlung:
          monatlicheEinzahlung === null || range.monatlicheEinzahlung,
        jahre: jahre === null || range.jahre,
      },
    };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (p) => {
      setFields({
        startkapital: formatMoneyInput(readMoney(p, "s", DEFAULTS.startkapital, MAX_MONEY)),
        endkapital: formatMoneyInput(readMoney(p, "e", DEFAULTS.endkapital, MAX_MONEY)),
        monatlicheEinzahlung: formatMoneyInput(
          readMoney(p, "m", DEFAULTS.monatlicheEinzahlung, MAX_MONEY),
        ),
        jahre: formatNumberInput(Math.round(readNumber(p, "j", DEFAULTS.jahre, 1, 80))),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("s", moneyParam(parsed.values.startkapital));
      p.set("e", moneyParam(parsed.values.endkapital));
      p.set("m", moneyParam(parsed.values.monatlicheEinzahlung));
      p.set("j", numberParam(parsed.values.jahre));
      return p;
    },
    !incomplete,
    JSON.stringify(parsed.values),
  );

  const result = useMemo(
    () => (incomplete ? null : berechneRendite(parsed.values)),
    [incomplete, parsed.values],
  );
  const r = result && result !== UNERREICHBAR ? result : null;
  const mitEinzahlungen = parsed.values.monatlicheEinzahlung > 0;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[20rem_1fr] lg:items-start">
      <form
        className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField
          id="startkapital"
          label="Wert am Anfang"
          suffix="€"
          value={fields.startkapital}
          onChange={set("startkapital")}
          invalid={parsed.invalid.startkapital}
          error="Bitte eine Zahl eingeben."
        />
        <NumberField
          id="monatlicheEinzahlung"
          label="Monatlich eingezahlt"
          suffix="€"
          value={fields.monatlicheEinzahlung}
          onChange={set("monatlicheEinzahlung")}
          invalid={parsed.invalid.monatlicheEinzahlung}
          hint="0, wenn du nur einmal angelegt hast."
          error="Bitte eine Zahl eingeben."
        />
        <NumberField
          id="endkapital"
          label="Wert am Ende"
          suffix="€"
          value={fields.endkapital}
          onChange={set("endkapital")}
          invalid={parsed.invalid.endkapital}
          error="Bitte eine Zahl eingeben."
        />
        <NumberField
          id="jahre"
          label="Zeitraum"
          suffix="Jahre"
          value={fields.jahre}
          onChange={set("jahre")}
          invalid={parsed.invalid.jahre}
          error={
            parsed.range.jahre ? "Zwischen 1 und 80 Jahren." : "Bitte eine Zahl eingeben."
          }
        />
      </form>

      <div className="order-1 rounded-xl border border-border bg-surface p-5 lg:col-start-2 lg:row-start-1">
        <p className="text-sm text-muted">Rendite pro Jahr</p>
        <p className="mt-1 overflow-x-auto text-4xl leading-tight font-semibold tabular-nums tracking-tight">
          {incomplete
            ? "—"
            : result === UNERREICHBAR
              ? "Nicht bestimmbar"
              : formatPercent(r!.rendite, 2)}
        </p>

        {incomplete ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : result === UNERREICHBAR ? (
          <p className="mt-1 text-sm text-muted">
            Mit diesen Zahlen lässt sich keine Rendite bestimmen — der Endwert
            liegt ausserhalb dessen, was Einzahlungen und Zeitraum hergeben.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {mitEinzahlungen
                ? "auf das Geld, wie es tatsächlich angelegt war"
                : `entspricht der Wertsteigerung über ${parsed.values.jahre} Jahre`}
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Eingezahlt</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r!.eingezahlt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Gewinn</dt>
                <dd
                  className={`text-lg font-medium tabular-nums ${
                    r!.gewinn >= 0 ? "text-accent" : ""
                  }`}
                >
                  {formatEuro(r!.gewinn)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Anfang zu Ende</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatPercent(r!.einfacheWertsteigerung, 2)}
                </dd>
                <p className="text-xs text-muted">
                  {mitEinzahlungen
                    ? "zu hoch — rechnet Einzahlungen als Rendite"
                    : "identisch, weil nichts eingezahlt wurde"}
                </p>
              </div>
            </dl>
            <CopyLinkButton scenarioKey={JSON.stringify(parsed.values)} />
          </>
        )}
      </div>
    </div>
  );
}
