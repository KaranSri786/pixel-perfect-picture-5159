import { Route, Siren } from "lucide-react";

import type { EmergencyRouteInfo } from "@/simulation/types";

const LIT = "var(--primary)";
const DIM = "var(--border)";

function RouteMap({ info }: { info: EmergencyRouteInfo }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full rounded-lg bg-background/60" role="img" aria-label="Emergency route on the junction network">
      {info.edges.map((e) => {
        const a = info.nodes.find((n) => n.id === e.a)!;
        const b = info.nodes.find((n) => n.id === e.b)!;
        return (
          <line
            key={`${e.a}-${e.b}`}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={e.onPath ? LIT : DIM}
            strokeWidth={e.onPath ? 3 : 1.5}
            strokeLinecap="round"
          />
        );
      })}
      {info.nodes.map((n) => {
        const isCenter = n.id === "B2";
        const isStart = n.id === info.start;
        const isDest = n.id === info.destination;
        return (
          <g key={n.id}>
            <circle
              cx={n.x} cy={n.y}
              r={isCenter ? 5 : 3.5}
              fill={isStart ? LIT : isDest ? "var(--destructive)" : isCenter ? "var(--accent)" : "var(--muted-foreground)"}
              stroke="var(--card)"
              strokeWidth={1.5}
            />
            <text x={n.x} y={n.y - 7} textAnchor="middle" fontSize={6} fill="var(--muted-foreground)">
              {n.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function EmergencyPanel({ emergency }: { emergency: EmergencyRouteInfo | null }) {
  return (
    <section aria-label="Emergency vehicle routing" className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <Siren className="size-4 text-destructive" aria-hidden />
        <h2 className="font-display text-sm font-semibold text-foreground">Emergency routing (A*)</h2>
      </div>

      {!emergency ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No emergency vehicle active. Spawn one to see A* pathfinding across the junction network with
          congestion-aware costs.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <RouteMap info={emergency} />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border/60 bg-background/60 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Route</div>
              <div className="font-semibold text-foreground">
                {emergency.start} → {emergency.destination}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Estimated cost (f = g + h)</div>
              <div className="tabular-nums font-semibold text-foreground">{emergency.cost}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Approach at junction</div>
              <div className="font-semibold text-foreground">{emergency.approach}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Waiting time</div>
              <div className="tabular-nums font-semibold text-foreground">{emergency.waitingTime.toFixed(1)}s</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Route className="size-3.5 text-primary" aria-hidden />
              Path: {emergency.path.join(" → ")}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                emergency.cleared ? "bg-secondary text-secondary-foreground" : "bg-destructive/20 text-destructive"
              }`}
            >
              {emergency.cleared ? "Cleared" : "En route"}
            </span>
          </div>
          {emergency.nextJunction ? (
            <p className="text-[11px] text-muted-foreground">
              Next junction along the route: <span className="font-semibold text-foreground">{emergency.nextJunction}</span> —
              its approach receives priority through a safe yellow + all-red transition.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
