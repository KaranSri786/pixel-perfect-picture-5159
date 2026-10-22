import { Pause, Play, TrafficCone } from "lucide-react";

import type { ControllerMode, SimSnapshot } from "@/simulation/types";

function formatClock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  snapshot: SimSnapshot;
  running: boolean;
  onToggleRun: () => void;
}

export function TopBar({ snapshot, running, onToggleRun }: Props) {
  const lightColor = (dirs: "NS" | "EW"): string => {
    const d = dirs === "NS" ? snapshot.lights.N : snapshot.lights.E;
    return d === "green" ? "var(--signal-green)" : d === "yellow" ? "var(--signal-amber)" : "var(--signal-red)";
  };
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2 md:hidden">
        <TrafficCone className="size-5 text-primary" aria-hidden />
        <span className="font-display text-sm font-bold">SignalWise</span>
      </div>
      <button
        onClick={onToggleRun}
        aria-label={running ? "Pause simulation" : "Start simulation"}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
          running ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"
        }`}
      >
        {running ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        <span className={`size-2 rounded-full ${running ? "animate-pulse bg-primary" : "bg-accent"}`} />
        {running ? "Running" : "Paused"}
      </button>
      <span className="tabular-nums text-sm font-semibold text-foreground">{formatClock(snapshot.time)}</span>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {snapshot.mode === "intelligent" ? "Intelligent Agent" : "Fixed-Time"} ·{" "}
        {snapshot.scenario === "peak" ? "Peak hour" : "Normal traffic"}
      </span>
      <div className="ml-auto flex items-center gap-3 text-xs" aria-label="Current signal phases">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: lightColor("NS") }} /> NS
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: lightColor("EW") }} /> EW
        </span>
      </div>
    </header>
  );
}
