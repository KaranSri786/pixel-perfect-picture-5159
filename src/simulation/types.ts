export type Direction = "N" | "S" | "E" | "W";

export const DIRECTIONS: readonly Direction[] = ["N", "S", "E", "W"];

export type VehicleType = "car" | "bus" | "emergency";

export type Phase = "NS" | "EW";

/** Light shown to an approach. */
export type SignalLightState = "green" | "yellow" | "red";

/** Internal controller state — includes the all-red clearance interval. */
export type SignalInternalState = "green" | "yellow" | "allred";

export type ControllerMode = "fixed" | "intelligent";

export type Scenario = "normal" | "peak";

export interface Vehicle {
  id: number;
  dir: Direction;
  type: VehicleType;
  isEmergency: boolean;
  /** Distance remaining to the stop line. Negative once inside the intersection. */
  pos: number;
  speed: number;
  cruise: number;
  length: number;
  gap: number;
  waitingTime: number;
  stopped: boolean;
  spawnTime: number;
}

export interface DirectionStat {
  queue: number;
  avgWait: number;
  emergencyWaiting: boolean;
}

export interface AgentWeights {
  queue: number;
  wait: number;
  emergency: number;
}

export interface DirectionDecision {
  queue: number;
  avgWait: number;
  utility: number;
}

export interface DecisionInfo {
  mode: ControllerMode;
  phase: Phase;
  nextPhase: Phase | null;
  reason: string;
  nsScore: number;
  ewScore: number;
  directions: Record<Direction, DirectionDecision>;
  emergencyPriority: boolean;
}

export interface RouteNode {
  id: string;
  x: number;
  y: number;
}

export interface RouteEdge {
  a: string;
  b: string;
  cost: number;
  onPath: boolean;
}

export interface EmergencyRouteInfo {
  vehicleId: number;
  approach: Direction;
  start: string;
  destination: string;
  path: string[];
  nextJunction: string | null;
  cost: number;
  waitingTime: number;
  cleared: boolean;
  nodes: RouteNode[];
  edges: RouteEdge[];
}

export interface MetricsSample {
  t: number;
  stoppedAvgWait: number;
  overallAvgWait: number;
  queueN: number;
  queueS: number;
  queueE: number;
  queueW: number;
  totalQueue: number;
  served: number;
  throughput: number;
  density: number;
  emergencyWaiting: number;
  emergencyAvgWait: number;
}

export interface SimSnapshot {
  time: number;
  mode: ControllerMode;
  scenario: Scenario;
  lights: Record<Direction, SignalLightState>;
  signal: { phase: Phase; state: SignalInternalState; elapsed: number };
  totals: {
    generated: number;
    served: number;
    waiting: number;
    avgWait: number;
    currentAvgWait: number;
    density: number;
    emergencyDetected: number;
    emergencyWaitingNow: number;
    emergencyAvgWait: number;
  };
  queues: Record<Direction, number>;
  decision: DecisionInfo | null;
  emergency: EmergencyRouteInfo | null;
  history: MetricsSample[];
}

export const PHASE_OF_DIRECTION: Record<Direction, Phase> = {
  N: "NS",
  S: "NS",
  E: "EW",
  W: "EW",
};

export function phaseName(phase: Phase): string {
  return phase === "NS" ? "North-South" : "East-West";
}

export function directionName(dir: Direction): string {
  return { N: "North", S: "South", E: "East", W: "West" }[dir];
}
