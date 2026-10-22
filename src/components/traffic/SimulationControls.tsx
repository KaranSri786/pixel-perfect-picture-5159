import { Pause, Play, RotateCcw, Siren, Zap } from "lucide-react";

import { SIM_CONFIG } from "@/simulation/config";
import type { ControllerMode, Scenario } from "@/simulation/types";

interface Props {
  running: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  mode: ControllerMode;
  onModeChange: (mode: ControllerMode) => void;
  scenario: Scenario;
  onScenarioChange: (scenario: Scenario) => void;
  rate: number;
  onRateChange: (rate: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  showAI: boolean;
  onShowAIChange: (show: boolean) => void;
  onSpawnEmergency: () => void;
}

const SPEEDS = [0.5, 1, 2, 4];

export function SimulationControls(props: Props) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={props.onToggleRun}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          {props.running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {props.running ? "Pause" : "Start"}
        </button>
        <button
          onClick={props.onReset}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition hover:bg-accent/20"
        >
          <RotateCcw className="size-4" aria-hidden />
          Reset
        </button>
        <button
          onClick={props.onSpawnEmergency}
          className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90"
        >
          <Siren className="size-4" aria-hidden />
          Spawn Emergency Vehicle
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Signal controller
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            {(["fixed", "intelligent"] as const).map((m) => (
              <button
                key={m}
                onClick={() => props.onModeChange(m)}
                aria-pressed={props.mode === m}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  props.mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "fixed" ? "Fixed-Time" : "Intelligent Agent"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Traffic scenario
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            {(["normal", "peak"] as const).map((s) => (
              <button
                key={s}
                onClick={() => props.onScenarioChange(s)}
                aria-pressed={props.scenario === s}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  props.scenario === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "normal" ? "Normal Traffic" : "Peak-Hour Traffic"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="arrival-rate" className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Vehicle arrival rate</span>
            <span className="tabular-nums text-foreground">{props.rate} veh/min</span>
          </label>
          <input
            id="arrival-rate"
            type="range"
            min={SIM_CONFIG.minArrivalRate}
            max={SIM_CONFIG.maxArrivalRate}
            step={2}
            value={props.rate}
            onChange={(e) => props.onRateChange(Number(e.target.value))}
            className="range-input w-full"
          />
          {props.scenario === "peak" ? (
            <div className="text-[11px] text-accent">Peak-hour multiplies this by {SIM_CONFIG.peakRateMultiplier}×</div>
          ) : null}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="flex items-center gap-1"><Zap className="size-3" aria-hidden /> Simulation speed</span>
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => props.onSpeedChange(s)}
                aria-pressed={props.speed === s}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold tabular-nums transition ${
                  props.speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={props.showAI}
          onChange={(e) => props.onShowAIChange(e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        Show AI decision details
      </label>
    </div>
  );
}
