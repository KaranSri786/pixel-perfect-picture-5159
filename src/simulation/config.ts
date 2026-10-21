import type { Phase, Scenario } from "./types";

/** All tunable simulation constants in one place. */
export const SIM_CONFIG = {
  roadLength: 260,
  exitLength: 130,
  yellowDuration: 2,
  allRedDuration: 1,
  fixedGreenDuration: 12,
  minGreen: 5,
  maxGreen: 18,
  defaultWeights: { queue: 3, wait: 0.5, emergency: 20 },
  carCruise: 58,
  busCruise: 44,
  emergencyCruise: 74,
  carLength: 22,
  busLength: 34,
  emergencyLength: 26,
  carGap: 13,
  busGap: 17,
  emergencyGap: 15,
  accel: 42,
  decel: 70,
  /** Extra following distance per unit of speed (time headway). */
  followTimeHeadway: 0.6,
  densityCapacity: 80,
  defaultArrivalRate: 60,
  minArrivalRate: 10,
  maxArrivalRate: 200,
  peakRateMultiplier: 2.5,
  normalBusProbability: 0.1,
  peakBusProbability: 0.24,
  comparisonDuration: 120,
  emergencySpawnTime: 30,
  defaultSeed: 42,
} as const;

export const PHASE_DIRECTIONS: Record<Phase, readonly Direction[]> = {
  NS: ["N", "S"],
  EW: ["E", "W"],
};

export const OTHER_PHASE: Record<Phase, Phase> = { NS: "EW", EW: "NS" };

type Direction = keyof ReturnType<typeof phaseDirections>;
function phaseDirections() {
  return { N: 0, S: 0, E: 0, W: 0 };
}

/** Arrival rate per approach, per second, for the given scenario. */
export function effectiveRatePerApproach(ratePerMinute: number, scenario: Scenario): number {
  const perApproachPerSecond = ratePerMinute / 60 / 4;
  return perApproachPerSecond * (scenario === "peak" ? SIM_CONFIG.peakRateMultiplier : 1);
}
