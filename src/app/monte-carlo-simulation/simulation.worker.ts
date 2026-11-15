/// <reference lib="webworker" />

import {
  simuliereMonteCarlo,
  type MonteCarloInput,
  type MonteCarloResult,
} from "@/lib/engine/finance/monte-carlo";

export interface SimulationRequest {
  id: number;
  input: MonteCarloInput;
}

export interface SimulationResponse {
  id: number;
  result: MonteCarloResult;
}

// Ten thousand paths over decades take a few hundred milliseconds — fine once,
// not on the main thread on every keystroke, where they would freeze the field
// being typed into.
self.onmessage = (event: MessageEvent<SimulationRequest>) => {
  const { id, input } = event.data;
  const result = simuliereMonteCarlo(input);
  const response: SimulationResponse = { id, result };
  // The per-path arrays run to several megabytes; hand them over instead of
  // copying them.
  const p = result.pfade;
  self.postMessage(response, [
    p.salden.buffer,
    p.jahresRenditen.buffer,
    p.maxDrawdown.buffer,
    p.drawdownTief.buffer,
    p.erschoepft.buffer,
    p.rangfolge.buffer,
  ]);
};
