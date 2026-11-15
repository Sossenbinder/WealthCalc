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
  const response: SimulationResponse = { id, result: simuliereMonteCarlo(input) };
  self.postMessage(response);
};
