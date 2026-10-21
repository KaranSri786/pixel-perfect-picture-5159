import { OTHER_PHASE, PHASE_DIRECTIONS, SIM_CONFIG } from "./config";
import type {
  AgentWeights,
  ControllerMode,
  DecisionInfo,
  Direction,
  DirectionDecision,
  DirectionStat,
  Phase,
  SignalInternalState,
  SignalLightState,
} from "./types";
import { PHASE_OF_DIRECTION, directionName, phaseName } from "./types";

export class SignalController {
  phase: Phase = "NS";
  state: SignalInternalState = "green";
  elapsed = 0;
  private allRedPending = false;

  /** Light colour shown to each approach. Only one phase is ever non-red. */
  get lights(): Record<Direction, SignalLightState> {
    const lights: Record<Direction, SignalLightState> = { N: "red", S: "red", E: "red", W: "red" };
    const active: SignalLightState =
      this.state === "green" ? "green" : this.state === "yellow" ? "yellow" : "red";
    for (const d of PHASE_DIRECTIONS[this.phase]) lights[d] = active;
    return lights;
  }

  /**
   * Advance the controller by dt. A switch is always green -> yellow
   * (-> all-red when requested) -> next green, never an instant change.
   * Returns true when a new green phase has just started.
   */
  tick(dt: number, wantsSwitch: boolean, useAllRed: boolean): boolean {
    this.elapsed += dt;
    if (this.state === "green") {
      if (wantsSwitch) {
        this.state = "yellow";
        this.elapsed = 0;
        this.allRedPending = useAllRed;
      }
      return false;
    }
    if (this.state === "yellow") {
      if (this.elapsed >= SIM_CONFIG.yellowDuration) {
        if (this.allRedPending) {
          this.state = "allred";
          this.elapsed = 0;
        } else {
          this.startNextPhase();
          return true;
        }
      }
      return false;
    }
    if (this.elapsed >= SIM_CONFIG.allRedDuration) {
      this.startNextPhase();
      return true;
    }
    return false;
  }

  private startNextPhase(): void {
    this.phase = OTHER_PHASE[this.phase];
    this.state = "green";
    this.elapsed = 0;
    this.allRedPending = false;
  }
}

export interface AgentDecision {
  wantsSwitch: boolean;
  useAllRed: boolean;
  emergencyPriority: boolean;
  info: DecisionInfo;
}

function computeUtilities(
  weights: AgentWeights,
  dirs: Record<Direction, DirectionStat>,
): Record<Direction, number> {
  return {
    N: weights.queue * dirs.N.queue + weights.wait * dirs.N.avgWait + (dirs.N.emergencyWaiting ? weights.emergency : 0),
    S: weights.queue * dirs.S.queue + weights.wait * dirs.S.avgWait + (dirs.S.emergencyWaiting ? weights.emergency : 0),
    E: weights.queue * dirs.E.queue + weights.wait * dirs.E.avgWait + (dirs.E.emergencyWaiting ? weights.emergency : 0),
    W: weights.queue * dirs.W.queue + weights.wait * dirs.W.avgWait + (dirs.W.emergencyWaiting ? weights.emergency : 0),
  };
}

function toDecisionDirections(
  dirs: Record<Direction, DirectionStat>,
  utilities: Record<Direction, number>,
): Record<Direction, DirectionDecision> {
  return {
    N: { queue: dirs.N.queue, avgWait: dirs.N.avgWait, utility: utilities.N },
    S: { queue: dirs.S.queue, avgWait: dirs.S.avgWait, utility: utilities.S },
    E: { queue: dirs.E.queue, avgWait: dirs.E.avgWait, utility: utilities.E },
    W: { queue: dirs.W.queue, avgWait: dirs.W.avgWait, utility: utilities.W },
  };
}

/** Baseline controller: a fixed 12 s green + 2 s yellow cycle. Ignores traffic. */
export class FixedTimeAgent {
  mode: ControllerMode = "fixed";
  weights: AgentWeights = { ...SIM_CONFIG.defaultWeights };

  decide(
    signal: SignalController,
    dirs: Record<Direction, DirectionStat>,
    _emergencyApproach: Direction | null,
  ): AgentDecision {
    const utilities = computeUtilities(this.weights, dirs);
    const nsScore = utilities.N + utilities.S;
    const ewScore = utilities.E + utilities.W;
    const wantsSwitch = signal.state === "green" && signal.elapsed >= SIM_CONFIG.fixedGreenDuration;
    let reason: string;
    if (signal.state === "yellow") {
      reason = `Fixed-time yellow on ${phaseName(signal.phase)} — ${phaseName(OTHER_PHASE[signal.phase])} receives green in ${Math.max(0, SIM_CONFIG.yellowDuration - signal.elapsed).toFixed(1)}s. Utilities are shown for reference only; this controller ignores them.`;
    } else if (signal.state === "allred") {
      reason = "All-red clearance before the next fixed-time phase starts.";
    } else {
      reason = `Fixed-time plan: ${phaseName(signal.phase)} runs ${SIM_CONFIG.fixedGreenDuration}s green, then ${SIM_CONFIG.yellowDuration}s yellow, then the opposite phase starts (${signal.elapsed.toFixed(1)}s of green elapsed). Utilities are shown for reference only.`;
    }
    return {
      wantsSwitch,
      useAllRed: false,
      emergencyPriority: false,
      info: {
        mode: "fixed",
        phase: signal.phase,
        nextPhase: wantsSwitch ? OTHER_PHASE[signal.phase] : null,
        reason,
        nsScore,
        ewScore,
        directions: toDecisionDirections(dirs, utilities),
        emergencyPriority: false,
      },
    };
  }
}

/**
 * Utility-based intelligent agent.
 *   U(d) = Wq * Q(d) + Ww * W(d) + We * E(d)
 * Phase scores are the sum of the two directions in the phase; the agent
 * switches only after the minimum green, is forced by the maximum green,
 * and always transitions through yellow (plus all-red for emergencies).
 */
export class IntelligentTrafficAgent {
  mode: ControllerMode = "intelligent";
  weights: AgentWeights = { ...SIM_CONFIG.defaultWeights };

  computeUtility(queue: number, avgWait: number, emergencyWaiting: boolean): number {
    return (
      this.weights.queue * queue +
      this.weights.wait * avgWait +
      (emergencyWaiting ? this.weights.emergency : 0)
    );
  }

  decide(
    signal: SignalController,
    dirs: Record<Direction, DirectionStat>,
    emergencyApproach: Direction | null,
  ): AgentDecision {
    const utilities = computeUtilities(this.weights, dirs);
    const nsScore = utilities.N + utilities.S;
    const ewScore = utilities.E + utilities.W;
    const other = OTHER_PHASE[signal.phase];
    const currentScore = signal.phase === "NS" ? nsScore : ewScore;
    const otherScore = signal.phase === "NS" ? ewScore : nsScore;
    const canSwitch = signal.state === "green" && signal.elapsed >= SIM_CONFIG.minGreen;
    const reachedMax = signal.state === "green" && signal.elapsed >= SIM_CONFIG.maxGreen;

    let wantsSwitch = false;
    let useAllRed = false;
    let emergencyPriority = false;
    let reason: string;

    if (signal.state === "yellow") {
      reason = `Yellow on ${phaseName(signal.phase)} — ${phaseName(other)} receives green in ${Math.max(0, SIM_CONFIG.yellowDuration - signal.elapsed).toFixed(1)}s. The yellow phase is never skipped.`;
    } else if (signal.state === "allred") {
      reason = "All-red clearance in progress — conflicting traffic is held before the next green starts.";
    } else if (
      emergencyApproach &&
      PHASE_OF_DIRECTION[emergencyApproach] !== signal.phase &&
      (canSwitch || reachedMax)
    ) {
      wantsSwitch = true;
      useAllRed = true;
      emergencyPriority = true;
      reason = `Emergency priority: an emergency vehicle is waiting on the ${directionName(emergencyApproach)} approach. Switching to ${phaseName(other)} through a ${SIM_CONFIG.yellowDuration}s yellow and a ${SIM_CONFIG.allRedDuration}s all-red clearance — never an instant change.`;
    } else if (reachedMax) {
      if (emergencyApproach && PHASE_OF_DIRECTION[emergencyApproach] === signal.phase) {
        reason = `${phaseName(signal.phase)} held past the usual ${SIM_CONFIG.maxGreen}s maximum — an emergency vehicle is actively using this green.`;
      } else {
        wantsSwitch = true;
        reason = `${phaseName(signal.phase)} reached the ${SIM_CONFIG.maxGreen}s maximum green to prevent starvation — switching to ${phaseName(other)}.`;
      }
    } else if (canSwitch && otherScore > currentScore) {
      wantsSwitch = true;
      const otherDirs = PHASE_DIRECTIONS[other];
      const topDir = otherDirs.reduce((a, b) => (utilities[b] > utilities[a] ? b : a));
      reason = `${phaseName(other)} selected because its combined utility (${otherScore.toFixed(1)}) is greater than ${phaseName(signal.phase)} (${currentScore.toFixed(1)}). The ${directionName(topDir)} approach has ${dirs[topDir].queue} waiting vehicle(s) with ${dirs[topDir].avgWait.toFixed(1)}s average wait.`;
    } else if (signal.elapsed < SIM_CONFIG.minGreen) {
      reason = `${phaseName(signal.phase)} retained — the ${SIM_CONFIG.minGreen}s minimum green is not yet reached (${signal.elapsed.toFixed(1)}s elapsed).`;
    } else {
      reason = `${phaseName(signal.phase)} retained — its combined utility (${currentScore.toFixed(1)}) is at least that of ${phaseName(other)} (${otherScore.toFixed(1)}), so the current green continues.`;
    }

    return {
      wantsSwitch,
      useAllRed,
      emergencyPriority,
      info: {
        mode: "intelligent",
        phase: signal.phase,
        nextPhase: wantsSwitch ? other : null,
        reason,
        nsScore,
        ewScore,
        directions: toDecisionDirections(dirs, utilities),
        emergencyPriority,
      },
    };
  }
}
