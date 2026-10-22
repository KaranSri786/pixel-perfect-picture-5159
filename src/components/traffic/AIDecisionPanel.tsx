import { Brain, Siren } from "lucide-react";

import type { AgentWeights, DecisionInfo, SimSnapshot } from "@/simulation/types";
import { phaseName } from "@/simulation/types";

interface Props {
  snapshot: SimSnapshot;
  weights: AgentWeights;
  onWeightsChange: (w: AgentWeights) => void;
}

const DIR_LABEL: Record<string, string> = { N: "North", S: "South", E: "East", W: "West" };

function ScoreBar({ label, score, active }: { label: string; score: number; active: boolean }) {
  const max = Math.max(1, 120);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className={active ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
        <span className="tabular-nums text-muted-foreground">{score.toFixed(1)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${Math.min(100, (score / max) * 100)}%`, opacity: active ? 1 : 0.45 }}
        />
      </div>
    </div>
  );
}

export function AIDecisionPanel({ snapshot, weights, onWeightsChange }: Props) {
  const decision: DecisionInfo | null = snapshot.decision;
  const isIntelligent = snapshot.mode === "intelligent";

  return (
    <section aria-label="AI decision explanation" className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <Brain className="size-4 text-primary" aria-hidden />
        <h2 className="font-display text-sm font-semibold text-foreground">
          Why did the agent choose this signal?
        </h2>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
          {isIntelligent ? "Intelligent Agent" : "Fixed-Time"}
        </span>
      </div>

      {!decision ? (
        <p className="mt-3 text-sm text-muted-foreground">Start the simulation to see live AI decisions.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-secondary px-2 py-1 font-semibold text-secondary-foreground">
              Current: {phaseName(decision.phase)}
            </span>
            {decision.nextPhase ? (
              <span className="rounded-md bg-primary/15 px-2 py-1 font-semibold text-primary">
                Next: {phaseName(decision.nextPhase)}
              </span>
            ) : (
              <span className="rounded-md bg-secondary px-2 py-1 text-muted-foreground">Retaining phase</span>
            )}
            {decision.emergencyPriority ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/20 px-2 py-1 font-semibold text-destructive">
                <Siren className="size-3" aria-hidden /> Emergency priority
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(["N", "S", "E", "W"] as const).map((d) => {
              const info = decision.directions[d];
              return (
                <div key={d} className="rounded-lg border border-border/60 bg-background/50 p-2 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {DIR_LABEL[d]}
                  </div>
                  <div className="mt-0.5 tabular-nums text-sm font-semibold text-foreground">{info.queue} queued</div>
                  <div className="tabular-nums text-[11px] text-muted-foreground">{info.avgWait.toFixed(1)}s avg</div>
                  <div className="mt-1 rounded bg-primary/10 tabular-nums text-[11px] font-semibold text-primary">
                    U = {info.utility.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>

          {isIntelligent ? (
            <div className="space-y-2">
              <ScoreBar label="North-South phase score" score={decision.nsScore} active={decision.phase === "NS"} />
              <ScoreBar label="East-West phase score" score={decision.ewScore} active={decision.phase === "EW"} />
            </div>
          ) : null}

          <p className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs leading-relaxed text-foreground/90">
            {decision.reason}
          </p>

          {isIntelligent ? (
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Utility weights (U = Wq·Q + Ww·W + We·E)
              </div>
              {(
                [
                  ["queue", "Queue weight", 0, 10, 0.5],
                  ["wait", "Wait weight", 0, 3, 0.1],
                  ["emergency", "Emergency weight", 0, 50, 1],
                ] as const
              ).map(([key, label, min, max, step]) => (
                <label key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-28 shrink-0">{label}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={weights[key]}
                    onChange={(e) => onWeightsChange({ ...weights, [key]: Number(e.target.value) })}
                    className="range-input flex-1"
                  />
                  <span className="w-10 text-right tabular-nums text-foreground">{weights[key]}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
