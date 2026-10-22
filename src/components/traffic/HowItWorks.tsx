import { BookOpen, Clock, GitCompareArrows, MapPinned, Sigma } from "lucide-react";

import { SIM_CONFIG } from "@/simulation/config";

export function HowItWorks() {
  return (
    <section aria-label="How the algorithms work" className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-primary" aria-hidden />
        <h2 className="font-display text-base font-semibold text-foreground">How the algorithms work</h2>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="size-4 text-muted-foreground" aria-hidden /> Fixed-Time Controller (baseline)
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Each phase gets {SIM_CONFIG.fixedGreenDuration}s of green followed by {SIM_CONFIG.yellowDuration}s of
            yellow, then the opposite phase starts. The cycle repeats regardless of how much traffic is
            waiting — that is exactly what makes it a useful baseline to beat.
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sigma className="size-4 text-muted-foreground" aria-hidden /> Utility-Based Intelligent Agent
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            For each direction:{" "}
            <span className="font-display font-semibold text-primary">U(d) = 3·Q(d) + 0.5·W(d) + 20·E(d)</span>,
            where Q is the waiting queue, W the average wait and E flags an emergency vehicle. Phase scores are
            the sum of their two directions. The agent switches after the {SIM_CONFIG.minGreen}s minimum green,
            is forced at the {SIM_CONFIG.maxGreen}s maximum green (no starvation), and always transitions
            through {SIM_CONFIG.yellowDuration}s of yellow.
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPinned className="size-4 text-muted-foreground" aria-hidden /> A* Emergency Routing
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            The road network is a weighted graph: junctions are nodes, roads are edges, and edge weights are
            travel times that rise with congestion. A* minimises{" "}
            <span className="font-display font-semibold text-primary">f(n) = g(n) + h(n)</span> using a
            Manhattan-distance heuristic, which is admissible on this grid, so the first path found is optimal.
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <GitCompareArrows className="size-4 text-muted-foreground" aria-hidden /> Fair Comparison
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Both controllers replay the identical vehicle arrival sequence (same random seed) for{" "}
            {SIM_CONFIG.comparisonDuration}s. Waiting-time reduction is computed as{" "}
            <span className="font-display font-semibold text-primary">
              ((Fixed − Intelligent) / Fixed) × 100%
            </span>
            , with zero denominators handled safely. The app always shows the measured outcome, whichever
            controller wins.
          </p>
        </div>
      </div>
    </section>
  );
}
