import { SIM_CONFIG } from "./config";
import { TrafficSimulation } from "./simulation";
import type { ControllerMode } from "./types";

export interface ComparisonMetrics {
  mode: ControllerMode;
  avgWait: number;
  avgQueue: number;
  maxQueue: number;
  served: number;
  throughput: number;
  emergencyAvgWait: number;
}

export interface ComparisonResult {
  fixed: ComparisonMetrics;
  intelligent: ComparisonMetrics;
  /** Positive means the intelligent agent waits less than fixed-time. */
  reductionPct: number;
  winner: "fixed" | "intelligent" | "tie";
  duration: number;
  seed: number;
}

export function reductionPercentage(fixedAvgWait: number, intelligentAvgWait: number): number {
  if (fixedAvgWait <= 0) return 0;
  return ((fixedAvgWait - intelligentAvgWait) / fixedAvgWait) * 100;
}

/**
 * Runs both controllers headlessly with the same seed, scenario, arrival
 * rate and duration, so the comparison is repeatable and fair.
 */
export function runComparison(options: {
  seed?: number;
  scenario: Parameters<TrafficSimulation["setScenario"]>[0];
  arrivalRate: number;
  duration?: number;
}): ComparisonResult {
  const seed = options.seed ?? SIM_CONFIG.defaultSeed;
  const duration = options.duration ?? SIM_CONFIG.comparisonDuration;
  const fixed = runHeadless("fixed", seed, options.scenario, options.arrivalRate, duration);
  const intelligent = runHeadless("intelligent", seed, options.scenario, options.arrivalRate, duration);
  const reductionPct = reductionPercentage(fixed.avgWait, intelligent.avgWait);
  const tolerance = 0.15;
  const winner: ComparisonResult["winner"] =
    Math.abs(fixed.avgWait - intelligent.avgWait) < tolerance
      ? "tie"
      : intelligent.avgWait < fixed.avgWait
        ? "intelligent"
        : "fixed";
  return { fixed, intelligent, reductionPct, winner, duration, seed };
}

function runHeadless(
  mode: ControllerMode,
  seed: number,
  scenario: "normal" | "peak",
  arrivalRate: number,
  duration: number,
): ComparisonMetrics {
  const sim = new TrafficSimulation({ seed, mode, scenario, arrivalRate });
  const dt = 1 / 30;
  const steps = Math.round(duration / dt);
  let emergencySpawned = false;
  for (let i = 0; i < steps; i++) {
    sim.step(dt);
    if (!emergencySpawned && sim.time >= SIM_CONFIG.emergencySpawnTime) {
      sim.spawnEmergency();
      emergencySpawned = true;
    }
  }
  const history = sim.metrics.history;
  const avgQueue =
    history.length > 0 ? history.reduce((s, h) => s + h.totalQueue, 0) / history.length : 0;
  const avgWait = sim.metrics.served > 0 ? sim.metrics.totalWaitServed / sim.metrics.served : 0;
  const emergencyAvgWait =
    sim.metrics.emergencyServedWaits.length > 0
      ? sim.metrics.emergencyServedWaits.reduce((a, b) => a + b, 0) / sim.metrics.emergencyServedWaits.length
      : 0;
  return {
    mode,
    avgWait,
    avgQueue,
    maxQueue: sim.metrics.maxQueueSeen,
    served: sim.metrics.served,
    throughput: duration > 0 ? sim.metrics.served / (duration / 60) : 0,
    emergencyAvgWait,
  };
}
