import { describe, expect, it } from "vitest";

import { aStar, buildEdges } from "@/simulation/astar";
import { reductionPercentage, runComparison } from "@/simulation/comparison";
import { SIM_CONFIG } from "@/simulation/config";
import { IntelligentTrafficAgent, SignalController } from "@/simulation/signal";
import { TrafficSimulation } from "@/simulation/simulation";
import type { Direction, DirectionStat } from "@/simulation/types";

const DT = 1 / 30;

function runFor(sim: TrafficSimulation, seconds: number, onStep?: (sim: TrafficSimulation) => void) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    sim.step(DT);
    onStep?.(sim);
  }
}

function greenDurations(sim: TrafficSimulation, seconds: number): number[] {
  const durations: number[] = [];
  let current = 0;
  runFor(sim, seconds, (s) => {
    if (s.signal.state === "green") current += DT;
    else if (current > 0) {
      durations.push(current);
      current = 0;
    }
  });
  if (current > 0) durations.push(current);
  return durations;
}

function yellowDurations(sim: TrafficSimulation, seconds: number): number[] {
  const durations: number[] = [];
  let current = 0;
  runFor(sim, seconds, (s) => {
    if (s.signal.state === "yellow") current += DT;
    else if (current > 0) {
      durations.push(current);
      current = 0;
    }
  });
  if (current > 0) durations.push(current);
  return durations;
}

describe("Fixed-time controller", () => {
  it("runs a 12 s green + 2 s yellow cycle and never skips yellow", () => {
    const sim = new TrafficSimulation({ mode: "fixed", scenario: "normal", arrivalRate: 60 });
    const greens = greenDurations(sim, 60);
    const yellows = yellowDurations(sim, 60);
    expect(greens.length).toBeGreaterThan(2);
    expect(yellows.length).toBeGreaterThan(2);
    for (const g of greens) {
      expect(g).toBeGreaterThanOrEqual(SIM_CONFIG.fixedGreenDuration - 0.1);
      expect(g).toBeLessThanOrEqual(SIM_CONFIG.fixedGreenDuration + 0.1);
    }
    for (const y of yellows) {
      expect(y).toBeGreaterThanOrEqual(SIM_CONFIG.yellowDuration - 0.1);
      expect(y).toBeLessThanOrEqual(SIM_CONFIG.yellowDuration + 0.1);
    }
  });
});

describe("Signal safety", () => {
  it("never gives green/yellow to conflicting approaches and no vehicle crosses on red or yellow", () => {
    const sim = new TrafficSimulation({ mode: "intelligent", scenario: "peak", arrivalRate: 150 });
    let conflicts = 0;
    runFor(sim, 90, (s) => {
      const lights = s.signal.lights;
      const active = (d: Direction) => lights[d] !== "red";
      const pairs: [Direction, Direction][] = [
        ["N", "E"], ["N", "W"], ["S", "E"], ["S", "W"],
      ];
      for (const [a, b] of pairs) {
        if (active(a) && active(b)) conflicts++;
      }
    });
    expect(conflicts).toBe(0);
    expect(sim.vehicles.crossedOnRed).toBe(0);
  });
});

describe("Intelligent agent phase timing", () => {
  it("respects the 5 s minimum and 18 s maximum green durations", () => {
    const sim = new TrafficSimulation({ mode: "intelligent", scenario: "peak", arrivalRate: 150 });
    const durations = greenDurations(sim, 90);
    expect(durations.length).toBeGreaterThan(2);
    for (const d of durations) {
      expect(d).toBeGreaterThanOrEqual(SIM_CONFIG.minGreen - 0.1);
      expect(d).toBeLessThanOrEqual(SIM_CONFIG.maxGreen + 0.1);
    }
  });

  it("computes U(d) = 3·Q + 0.5·W + 20·E", () => {
    const agent = new IntelligentTrafficAgent();
    expect(agent.computeUtility(4, 10, true)).toBeCloseTo(3 * 4 + 0.5 * 10 + 20);
    expect(agent.computeUtility(4, 10, false)).toBeCloseTo(3 * 4 + 0.5 * 10);
  });

  it("gives an emergency vehicle priority through yellow + all-red, never instantly", () => {
    const agent = new IntelligentTrafficAgent();
    const signal = new SignalController();
    signal.elapsed = 6; // past minimum green, NS green
    const dirs: Record<Direction, DirectionStat> = {
      N: { queue: 1, avgWait: 2, emergencyWaiting: false },
      S: { queue: 0, avgWait: 0, emergencyWaiting: false },
      E: { queue: 1, avgWait: 1, emergencyWaiting: true },
      W: { queue: 0, avgWait: 0, emergencyWaiting: false },
    };
    const decision = agent.decide(signal, dirs, "E");
    expect(decision.wantsSwitch).toBe(true);
    expect(decision.useAllRed).toBe(true);
    expect(decision.info.emergencyPriority).toBe(true);
  });

  it("routes an emergency vehicle through the centre junction and serves it", () => {
    const sim = new TrafficSimulation({ seed: 3, mode: "intelligent", scenario: "peak", arrivalRate: 150 });
    runFor(sim, 10);
    expect(sim.spawnEmergency()).toBe(true);
    const route = sim.emergency!;
    expect(route.path[0]).toBe(route.start);
    expect(route.path[route.path.length - 1]).toBe(route.destination);
    expect(route.path).toContain("B2");
    expect(route.cost).toBeGreaterThan(0);
    let gotGreen = false;
    runFor(sim, 25, (s) => {
      if (s.emergency && s.lights[s.emergency.approach] === "green") gotGreen = true;
    });
    expect(gotGreen).toBe(true);
  });
});

describe("A* routing", () => {
  it("finds a valid adjacent path and cost at least the admissible heuristic", () => {
    const edges = buildEdges({ N: 0, S: 0, E: 0, W: 0 });
    const result = aStar(edges, "A1", "C3");
    expect(result).not.toBeNull();
    const { path, cost } = result!;
    expect(path[0]).toBe("A1");
    expect(path[path.length - 1]).toBe("C3");
    for (let i = 0; i < path.length - 1; i++) {
      const [a, b] = [path[i], path[i + 1]];
      expect(edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))).toBe(true);
    }
    expect(cost).toBeGreaterThanOrEqual(4); // Manhattan distance from A1 to C3
  });

  it("avoids a congested centre junction when a detour is cheaper", () => {
    const congested = buildEdges({ N: 20, S: 20, E: 20, W: 20 });
    const result = aStar(congested, "A1", "C3");
    expect(result).not.toBeNull();
    expect(result!.path).not.toContain("B2");
  });
});

describe("Fair comparison", () => {
  it("reduces waiting-time percentage safely with a zero denominator", () => {
    expect(reductionPercentage(0, 10)).toBe(0);
    expect(reductionPercentage(20, 15)).toBeCloseTo(25);
  });

  it("uses identical arrival sequences for both controllers with the same seed", () => {
    const fixed = new TrafficSimulation({ seed: 7, mode: "fixed", scenario: "normal", arrivalRate: 60 });
    const intelligent = new TrafficSimulation({ seed: 7, mode: "intelligent", scenario: "normal", arrivalRate: 60 });
    runFor(fixed, 60);
    runFor(intelligent, 60);
    expect(fixed.vehicles.arrivalDemand).toBe(intelligent.vehicles.arrivalDemand);
    expect(fixed.vehicles.totalGenerated).toBe(intelligent.vehicles.totalGenerated);
  });

  it("produces a complete measured comparison result", () => {
    const result = runComparison({ seed: 11, scenario: "peak", arrivalRate: 120, duration: 60 });
    expect(result.fixed.served).toBeGreaterThan(0);
    expect(result.intelligent.served).toBeGreaterThan(0);
    expect(result.reductionPct).toBeTypeOf("number");
    expect(["fixed", "intelligent", "tie"]).toContain(result.winner);
  });
});
