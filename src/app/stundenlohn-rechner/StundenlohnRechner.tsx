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
import { berechneArbeitszeit } from "@/lib/engine/finance/arbeitszeit";
import {
  moneyParam,
  numberParam,
  readMoney,
  readNumber,
  useScenarioUrl,
} from "@/lib/useScenarioUrl";

const MAX_MONEY = 100_000_000_00;
const DEFAULTS = {
  monatsgehalt: 4_000_00,
  wochenstunden: 40,
  urlaubstage: 30,
  feiertage: 10,
  sonderzahlungen: 0,
};
const outOfRange = (v: number | null, min: number, max: number) =>
  v !== null && (v < min || v > max);

export function StundenlohnRechner() {
  const [fields, setFields] = useState({
    monatsgehalt: formatMoneyInput(DEFAULTS.monatsgehalt),
    wochenstunden: formatNumberInput(DEFAULTS.wochenstunden),
    urlaubstage: formatNumberInput(DEFAULTS.urlaubstage),
    feiertage: formatNumberInput(DEFAULTS.feiertage),
    sonderzahlungen: formatNumberInput(DEFAULTS.sonderzahlungen),
  });
  const set = (k: keyof typeof fields) => (v: string) =>
    setFields((c) => ({ ...c, [k]: v }));

  const parsed = useMemo(() => {
    const monatsgehalt = parseMoney(fields.monatsgehalt);
    const wochenstunden = parseGermanNumber(fields.wochenstunden);
    const urlaubstage = parseGermanNumber(fields.urlaubstage);
    const feiertage = parseGermanNumber(fields.feiertage);
    const sonderzahlungen = parseGermanNumber(fields.sonderzahlungen);
    const range = {
      monatsgehalt: outOfRange(monatsgehalt, 0, MAX_MONEY),
      wochenstunden: outOfRange(wochenstunden, 0, 80),
      urlaubstage: outOfRange(urlaubstage, 0, 200),
      feiertage: outOfRange(feiertage, 0, 100),
      sonderzahlungen: outOfRange(sonderzahlungen, 0, 6),
    };
    return {
      values: {
        monatsgehalt: monatsgehalt ?? DEFAULTS.monatsgehalt,
        wochenstunden: wochenstunden ?? DEFAULTS.wochenstunden,
        urlaubstage: Math.round(urlaubstage ?? DEFAULTS.urlaubstage),
        feiertage: Math.round(feiertage ?? DEFAULTS.feiertage),
        sonderzahlungen: sonderzahlungen ?? DEFAULTS.sonderzahlungen,
      },
      range,
      invalid: {
        monatsgehalt: monatsgehalt === null || range.monatsgehalt,
        wochenstunden: wochenstunden === null || range.wochenstunden,
        urlaubstage: urlaubstage === null || range.urlaubstage,
        feiertage: feiertage === null || range.feiertage,
        sonderzahlungen: sonderzahlungen === null || range.sonderzahlungen,
      },
    };
  }, [fields]);

  const incomplete = Object.values(parsed.invalid).some(Boolean);

  useScenarioUrl(
    (p) => {
      setFields({
        monatsgehalt: formatMoneyInput(readMoney(p, "g", DEFAULTS.monatsgehalt, MAX_MONEY)),
        wochenstunden: formatNumberInput(readNumber(p, "h", DEFAULTS.wochenstunden, 0, 80)),
        urlaubstage: formatNumberInput(Math.round(readNumber(p, "u", DEFAULTS.urlaubstage, 0, 200))),
        feiertage: formatNumberInput(Math.round(readNumber(p, "f", DEFAULTS.feiertage, 0, 100))),
        sonderzahlungen: formatNumberInput(readNumber(p, "s", DEFAULTS.sonderzahlungen, 0, 6)),
      });
    },
    () => {
      const p = new URLSearchParams();
      p.set("g", moneyParam(parsed.values.monatsgehalt));
      p.set("h", numberParam(parsed.values.wochenstunden));
      p.set("u", numberParam(parsed.values.urlaubstage));
      p.set("f", numberParam(parsed.values.feiertage));
      p.set("s", numberParam(parsed.values.sonderzahlungen));
      return p;
    },
    !incomplete,
    JSON.stringify(parsed.values),
  );

  const r = useMemo(
    () => (incomplete ? null : berechneArbeitszeit(parsed.values)),
    [incomplete, parsed.values],
  );

  return (
    <div className="calc-grid">
      <form
        className="card calc-form order-2 flex flex-col gap-4 p-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <NumberField id="monatsgehalt" label="Monatsgehalt (brutto)" suffix="€"
          value={fields.monatsgehalt} onChange={set("monatsgehalt")}
          invalid={parsed.invalid.monatsgehalt} error="Bitte eine Zahl eingeben." />
        <NumberField id="wochenstunden" label="Wochenstunden" suffix="h"
          value={fields.wochenstunden} onChange={set("wochenstunden")}
          invalid={parsed.invalid.wochenstunden}
          hint="Bei einer Fünftagewoche."
          error={parsed.range.wochenstunden ? "Zwischen 0 und 80." : "Bitte eine Zahl eingeben."} />
        <NumberField id="urlaubstage" label="Urlaubstage" suffix="Tage"
          value={fields.urlaubstage} onChange={set("urlaubstage")}
          invalid={parsed.invalid.urlaubstage}
          error={parsed.range.urlaubstage ? "Zwischen 0 und 200." : "Bitte eine Zahl eingeben."} />
        <NumberField id="feiertage" label="Feiertage" suffix="Tage"
          value={fields.feiertage} onChange={set("feiertage")}
          invalid={parsed.invalid.feiertage}
          hint="Die auf einen Arbeitstag fallen."
          error={parsed.range.feiertage ? "Zwischen 0 und 100." : "Bitte eine Zahl eingeben."} />
        <NumberField id="sonderzahlungen" label="Zusätzliche Monatsgehälter" suffix="×"
          value={fields.sonderzahlungen} onChange={set("sonderzahlungen")}
          invalid={parsed.invalid.sonderzahlungen}
          hint="13. Gehalt, Urlaubsgeld — 0, wenn keine."
          error={parsed.range.sonderzahlungen ? "Zwischen 0 und 6." : "Bitte eine Zahl eingeben."} />
      </form>

      <div data-result-card
        className="card order-1 p-5">
        <p data-result-label className="text-sm font-medium text-muted">Stundenlohn für gearbeitete Stunden</p>
        <p data-result-value className="mt-1.5 overflow-x-auto text-4xl sm:text-5xl leading-tight font-semibold tabular-nums tracking-tight">
          {r === null ? "—" : formatEuro(r.stundenlohnEffektiv)}
        </p>
        {r === null ? (
          <p className="mt-1 text-sm text-muted">Bitte die Eingaben prüfen.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {/* aufschlagProzent ist der Aufschlag auf den vertraglichen Satz,
                  nicht der Abschlag vom effektiven — andersherum formuliert
                  wäre die Zahl schlicht falsch. */}
              das sind {formatPercent(r.aufschlagProzent, 1)} mehr als die{" "}
              {formatEuro(r.stundenlohnNominal)} auf die vertraglichen Stunden
            </p>
            <dl className="mt-5 grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
              <div>
                <dt className="text-sm text-muted">Jahresgehalt</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatEuro(r.jahresgehalt)}
                </dd>
                <p className="text-xs text-muted">brutto, mit Sonderzahlungen</p>
              </div>
              <div>
                <dt className="text-sm text-muted">Gearbeitete Stunden</dt>
                <dd className="text-lg font-medium tabular-nums">
                  {formatNumberInput(r.gearbeiteteStunden)}
                </dd>
                <p className="text-xs text-muted">
                  {r.arbeitstage} Arbeitstage statt {formatNumberInput(r.vertraglicheStunden)} h laut Vertrag
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted">Wert der freien Tage</dt>
                <dd className="text-lg font-medium tabular-nums text-accent">
                  {formatEuro(r.wertDerFreienTage)}
                </dd>
                <p className="text-xs text-muted">
                  {r.bezahlteFreieTage} bezahlte Tage, an denen du nicht arbeitest
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
