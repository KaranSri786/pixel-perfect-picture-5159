import {
  aStar,
  approachForEntry,
  buildEdges,
  buildNetworkEdges,
  CENTER_JUNCTION,
  GRID_JUNCTIONS,
} from "./astar";
import { SIM_CONFIG } from "./config";
import { MetricsEngine } from "./metrics";
import { Rng } from "./rng";
import { FixedTimeAgent, IntelligentTrafficAgent, SignalController } from "./signal";
import { VehicleManager } from "./vehicles";
import {
  DIRECTIONS,
  PHASE_OF_DIRECTION,
  type AgentWeights,
  type ControllerMode,
  type DecisionInfo,
  type Direction,
  type DirectionStat,
  type EmergencyRouteInfo,
  type Scenario,
  type SimSnapshot,
  type SignalInternalState,
  type Vehicle,
} from "./types";

export interface SimulationOptions {
  seed?: number;
  mode: ControllerMode;
  scenario: Scenario;
  arrivalRate: number;
}

/**
 * Owns the full simulation state and advances it with a fixed timestep.
 * Rendering and React state are kept completely separate from this module.
 */
export class TrafficSimulation {
  time = 0;
  mode: ControllerMode;
  scenario: Scenario;
  signal = new SignalController();
  vehicles: VehicleManager;
  metrics = new MetricsEngine();
  agent: FixedTimeAgent | IntelligentTrafficAgent;
  decision: DecisionInfo | null = null;
  emergency: EmergencyRouteInfo | null = null;

  private emergencyVehicles: { id: number }[] = [];
  private routeRng: Rng;
  private seed: number;

  constructor(options: SimulationOptions) {
    this.seed = options.seed ?? SIM_CONFIG.defaultSeed;
    this.mode = options.mode;
    this.scenario = options.scenario;
    this.vehicles = new VehicleManager(
      this.seed * 7 + 1,
      this.seed * 13 + 5,
      options.scenario,
      options.arrivalRate,
    );
    this.agent = options.mode === "fixed" ? new FixedTimeAgent() : new IntelligentTrafficAgent();
    this.routeRng = new Rng(this.seed * 31 + 7);
  }

  get lights(): Record<Direction, import("./types").SignalLightState> {
    return this.signal.lights;
  }

  get weights(): AgentWeights {
    const w = this.agent instanceof IntelligentTrafficAgent ? this.agent.weights : SIM_CONFIG.defaultWeights;
    return { ...w };
  }

  setMode(mode: ControllerMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.agent = mode === "fixed" ? new FixedTimeAgent() : new IntelligentTrafficAgent();
  }

  setScenario(scenario: Scenario): void {
    this.scenario = scenario;
    this.vehicles.setScenario(scenario);
  }

  setArrivalRate(ratePerMinute: number): void {
    this.vehicles.setRate(ratePerMinute);
  }

  setWeights(weights: AgentWeights): void {
    if (this.agent instanceof IntelligentTrafficAgent) this.agent.weights = { ...weights };
  }

  queueCounts(): Record<Direction, number> {
    const counts: Record<Direction, number> = { N: 0, S: 0, E: 0, W: 0 };
    for (const v of this.vehicles.vehicles) {
      if (v.stopped && v.pos >= 0) counts[v.dir]++;
    }
    return counts;
  }

  getDirectionStats(): Record<Direction, DirectionStat> {
    const stats: Record<Direction, DirectionStat> = {
      N: { queue: 0, avgWait: 0, emergencyWaiting: false },
      S: { queue: 0, avgWait: 0, emergencyWaiting: false },
      E: { queue: 0, avgWait: 0, emergencyWaiting: false },
      W: { queue: 0, avgWait: 0, emergencyWaiting: false },
    };
    const waitSums: Record<Direction, number> = { N: 0, S: 0, E: 0, W: 0 };
    for (const v of this.vehicles.vehicles) {
      if (v.stopped && v.pos >= 0) {
        stats[v.dir].queue++;
        waitSums[v.dir] += v.waitingTime;
        if (v.isEmergency) stats[v.dir].emergencyWaiting = true;
      }
    }
    for (const d of DIRECTIONS) {
      stats[d].avgWait = stats[d].queue > 0 ? waitSums[d] / stats[d].queue : 0;
    }
    return stats;
  }

  step(dt: number): void {
    this.time += dt;
    const stats = this.getDirectionStats();

    let emergencyApproach: Direction | null = null;
    for (const ev of this.emergencyVehicles) {
      const v = this.vehicles.vehicles.find((x) => x.id === ev.id);
      if (v && (v.stopped || v.pos < 110)) {
        emergencyApproach = v.dir;
        break;
      }
    }

    const decision = this.agent.decide(this.signal, stats, emergencyApproach);
    this.decision = decision.info;
    this.signal.tick(dt, decision.wantsSwitch, decision.useAllRed);

    const removed = this.vehicles.tick(dt, this.time, this.signal.lights);
    for (const r of removed) {
      this.metrics.recordRemoval(r.waitTime, r.isEmergency);
      if (r.isEmergency) {
        this.emergencyVehicles = this.emergencyVehicles.filter((e) => e.id !== r.id);
        if (this.emergency && this.emergency.vehicleId === r.id) this.emergency.cleared = true;
      }
    }

    if (this.emergency && !this.emergency.cleared && this.emergency.vehicleId != null) {
      const v = this.vehicles.vehicles.find((x) => x.id === this.emergency!.vehicleId);
      if (v) this.emergency.waitingTime = v.waitingTime;
    }

    const totalQueue = DIRECTIONS.reduce((sum, d) => sum + stats[d].queue, 0);
    const stopped = this.vehicles.vehicles.filter((v) => v.stopped && v.pos >= 0);
    const stoppedAvgWait =
      stopped.length > 0 ? stopped.reduce((s, v) => s + v.waitingTime, 0) / stopped.length : 0;
    const emergencies = this.vehicles.vehicles.filter((v) => v.isEmergency);
    const servedEmergencyAvg =
      this.metrics.emergencyServedWaits.length > 0
        ? this.metrics.emergencyServedWaits.reduce((a, b) => a + b, 0) / this.metrics.emergencyServedWaits.length
        : 0;
    const emergencyAvgWait =
      emergencies.length > 0
        ? emergencies.reduce((s, v) => s + v.waitingTime, 0) / emergencies.length
        : servedEmergencyAvg;
    const density = Math.min(1, this.vehicles.vehicles.length / SIM_CONFIG.densityCapacity);

    this.metrics.sample(dt, this.time, {
      stoppedAvgWait,
      queues: { N: stats.N.queue, S: stats.S.queue, E: stats.E.queue, W: stats.W.queue },
      totalQueue,
      density,
      emergencyWaiting: emergencies.filter((v) => v.stopped).length,
      emergencyAvgWait,
    });
  }

  /**
   * Spawns an emergency vehicle and routes it with A* over the weighted
   * junction network. The route always passes through the simulated centre
   * junction, whose approach then receives signal priority.
   */
  spawnEmergency(): boolean {
    const stats = this.getDirectionStats();
    const edges = buildEdges({ N: stats.N.queue, S: stats.S.queue, E: stats.E.queue, W: stats.W.queue });
    const outer = GRID_JUNCTIONS.filter((j) => j.id !== CENTER_JUNCTION);
    const start = this.routeRng.pick(outer).id;
    const dest = this.routeRng.pick(outer.filter((j) => j.id !== start)).id;
    const toCenter = aStar(edges, start, CENTER_JUNCTION);
    const fromCenter = aStar(edges, CENTER_JUNCTION, dest);
    if (!toCenter || !fromCenter) return false;
    const previous = toCenter.path.length >= 2 ? toCenter.path[toCenter.path.length - 2] : null;
    const approach = previous ? approachForEntry(previous) : null;
    if (!approach) return false;
    const vehicle: Vehicle = this.vehicles.spawnEmergency(approach, this.time);
    this.emergencyVehicles.push({ id: vehicle.id });
    this.emergency = {
      vehicleId: vehicle.id,
      approach,
      start,
      destination: dest,
      path: [...toCenter.path, ...fromCenter.path.slice(1)],
      nextJunction: fromCenter.path[1] ?? null,
      cost: Math.round((toCenter.cost + fromCenter.cost) * 10) / 10,
      waitingTime: 0,
      cleared: false,
      nodes: GRID_JUNCTIONS.map((j) => ({ id: j.id, x: j.col * 40 + 10, y: j.row * 40 + 10 })),
      edges: buildNetworkEdges(edges, this.emergency?.path ?? []),
    };
    this.emergency.edges = buildNetworkEdges(edges, this.emergency!.path);
    return true;
  }

  snapshot(): SimSnapshot {
    const stats = this.getDirectionStats();
    const waiting = DIRECTIONS.reduce((sum, d) => sum + stats[d].queue, 0);
    const stopped = this.vehicles.vehicles.filter((v) => v.stopped && v.pos >= 0);
    const currentAvgWait =
      stopped.length > 0 ? stopped.reduce((s, v) => s + v.waitingTime, 0) / stopped.length : 0;
    const overallAvgWait =
      this.metrics.served > 0 ? this.metrics.totalWaitServed / this.metrics.served : currentAvgWait;
    const emergencies = this.vehicles.vehicles.filter((v) => v.isEmergency);
    const servedEmergencyAvg =
      this.metrics.emergencyServedWaits.length > 0
        ? this.metrics.emergencyServedWaits.reduce((a, b) => a + b, 0) / this.metrics.emergencyServedWaits.length
        : 0;
    const emergencyAvgWait =
      emergencies.length > 0
        ? emergencies.reduce((s, v) => s + v.waitingTime, 0) / emergencies.length
        : servedEmergencyAvg;
    return {
      time: this.time,
      mode: this.mode,
      scenario: this.scenario,
      lights: this.signal.lights,
      signal: {
        phase: this.signal.phase,
        state: this.signal.state as SignalInternalState,
        elapsed: this.signal.elapsed,
      },
      totals: {
        generated: this.vehicles.totalGenerated,
        served: this.metrics.served,
        waiting,
        avgWait: overallAvgWait,
        currentAvgWait,
        density: Math.min(1, this.vehicles.vehicles.length / SIM_CONFIG.densityCapacity),
        emergencyDetected: this.vehicles.emergencySpawned,
        emergencyWaitingNow: emergencies.filter((v) => v.stopped).length,
        emergencyAvgWait,
      },
      queues: { N: stats.N.queue, S: stats.S.queue, E: stats.E.queue, W: stats.W.queue },
      decision: this.decision,
      emergency: this.emergency,
      history: [...this.metrics.history],
    };
  }
}

export { PHASE_OF_DIRECTION };
