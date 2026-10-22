import { Car, CheckCircle2, Clock3, Gauge, Hourglass, Siren, TrafficCone, Users } from "lucide-react";

import type { SimSnapshot } from "@/simulation/types";

function formatClock(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function StatCards({ snapshot }: { snapshot: SimSnapshot }) {
  const t = snapshot.totals;
  const stats: { label: string; value: string; icon: typeof Car; hint?: string }[] = [
    { label: "Vehicles generated", value: String(t.generated), icon: Car },
    { label: "Vehicles served", value: String(t.served), icon: CheckCircle2 },
    { label: "Currently waiting", value: String(t.waiting), icon: Users },
    {
      label: "Avg waiting time",
      value: `${t.avgWait.toFixed(1)}s`,
      icon: Hourglass,
      hint: `waiting now: ${t.currentAvgWait.toFixed(1)}s`,
    },
    { label: "Traffic density", value: `${Math.round(t.density * 100)}%`, icon: Gauge },
    { label: "Emergency vehicles", value: String(t.emergencyDetected), icon: Siren, hint: `${t.emergencyWaitingNow} waiting` },
    {
      label: "Signal phase",
      value:
        snapshot.signal.state === "allred"
          ? "All-red"
          : `${snapshot.signal.phase} ${snapshot.signal.state}`,
      icon: TrafficCone,
      hint: `${snapshot.signal.elapsed.toFixed(1)}s in state`,
    },
    { label: "Simulation time", value: formatClock(snapshot.time), icon: Clock3 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-border/60 bg-card p-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <s.icon className="size-4 text-primary" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wide">{s.label}</span>
          </div>
          <div className="mt-1.5 font-display text-xl font-semibold tabular-nums text-foreground">
            {s.value}
          </div>
          {s.hint ? <div className="text-[11px] text-muted-foreground">{s.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
