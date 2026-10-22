import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AIDecisionPanel } from "@/components/traffic/AIDecisionPanel";
import { AnalyticsPanel } from "@/components/traffic/AnalyticsPanel";
import { EmergencyPanel } from "@/components/traffic/EmergencyPanel";
import { HowItWorks } from "@/components/traffic/HowItWorks";
import { SimulationControls } from "@/components/traffic/SimulationControls";
import { MobileNav, Sidebar } from "@/components/traffic/Sidebar";
import { StatCards } from "@/components/traffic/StatCards";
import { TopBar } from "@/components/traffic/TopBar";
import { TrafficCanvas } from "@/components/traffic/TrafficCanvas";
import { runComparison, type ComparisonResult } from "@/simulation/comparison";
import { SIM_CONFIG } from "@/simulation/config";
import { TrafficSimulation } from "@/simulation/simulation";
import type { AgentWeights, ControllerMode, Scenario, SimSnapshot } from "@/simulation/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intelligent Traffic Signal Agent | AI Traffic Congestion Management" },
      {
        name: "description",
        content:
          "Interactive four-way traffic simulation: a utility-based AI signal agent vs fixed-time control, emergency vehicle priority with A* routing, and live analytics charts.",
      },
      { property: "og:title", content: "Intelligent Traffic Signal Agent" },
      {
        property: "og:description",
        content:
          "AI-based traffic congestion management — live intersection simulation, utility-based agent, A* emergency routing and fair controller comparison.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Intelligent Traffic Signal Agent" },
      {
        name: "twitter:description",
        content: "AI-based traffic congestion management with a live simulation, utility agent and analytics.",
      },
    ],
  }),
  component: Index,
});

const STEP = 1 / 60;

function Index() {
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<ControllerMode>("intelligent");
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [rate, setRate] = useState(SIM_CONFIG.defaultArrivalRate);
  const [showAI, setShowAI] = useState(true);
  const [weights, setWeights] = useState<AgentWeights>({ ...SIM_CONFIG.defaultWeights });
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [comparisonRunning, setComparisonRunning] = useState(false);

  const engineRef = useRef<TrafficSimulation | null>(null);
  if (!engineRef.current) {
    engineRef.current = new TrafficSimulation({
      mode: "intelligent",
      scenario: "normal",
      arrivalRate: SIM_CONFIG.defaultArrivalRate,
    });
  }
  const [snapshot, setSnapshot] = useState<SimSnapshot>(() => engineRef.current!.snapshot());

  const runningRef = useRef(running);
  runningRef.current = running;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => engineRef.current?.setMode(mode), [mode]);
  useEffect(() => engineRef.current?.setScenario(scenario), [scenario]);
  useEffect(() => engineRef.current?.setArrivalRate(rate), [rate]);
  useEffect(() => engineRef.current?.setWeights(weights), [weights]);

  // Fixed-timestep simulation loop, decoupled from rendering.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let publishAcc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dtReal = Math.min(0.1, (now - last) / 1000);
      last = now;
      const sim = engineRef.current;
      if (runningRef.current && sim) {
        acc += dtReal * speedRef.current;
        let steps = 0;
        while (acc >= STEP && steps < 60) {
          sim.step(STEP);
          acc -= STEP;
          steps++;
        }
        if (acc > STEP * 60) acc = 0;
      }
      publishAcc += dtReal;
      if (publishAcc >= 0.12 && sim) {
        publishAcc = 0;
        setSnapshot(sim.snapshot());
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const reset = useCallback(() => {
    const fresh = new TrafficSimulation({ mode, scenario, arrivalRate: rate });
    fresh.setWeights(weights);
    engineRef.current = fresh;
    setSnapshot(fresh.snapshot());
  }, [mode, scenario, rate, weights]);

  const runComparisonNow = useCallback(() => {
    setComparisonRunning(true);
    window.setTimeout(() => {
      try {
        setComparison(
          runComparison({ scenario, arrivalRate: rate, duration: SIM_CONFIG.comparisonDuration }),
        );
      } finally {
        setComparisonRunning(false);
      }
    }, 30);
  }, [scenario, rate]);

  useEffect(() => {
    runComparisonNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSim = useCallback(() => engineRef.current, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar snapshot={snapshot} running={running} onToggleRun={() => setRunning((r) => !r)} />
        <main className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
          <MobileNav />
          <StatCards snapshot={snapshot} />

          <section id="live" className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-card p-3">
                <TrafficCanvas getSim={getSim} />
              </div>
              <SimulationControls
                running={running}
                onToggleRun={() => setRunning((r) => !r)}
                onReset={reset}
                mode={mode}
                onModeChange={setMode}
                scenario={scenario}
                onScenarioChange={setScenario}
                rate={rate}
                onRateChange={setRate}
                speed={speed}
                onSpeedChange={setSpeed}
                showAI={showAI}
                onShowAIChange={setShowAI}
                onSpawnEmergency={() => engineRef.current?.spawnEmergency()}
              />
            </div>
            <div id="ai" className="space-y-4">
              {showAI ? (
                <AIDecisionPanel snapshot={snapshot} weights={weights} onWeightsChange={setWeights} />
              ) : null}
              <EmergencyPanel emergency={snapshot.emergency} />
            </div>
          </section>

          <section id="analytics" className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Analytics</h2>
            <AnalyticsPanel
              history={snapshot.history}
              comparison={comparison}
              comparisonRunning={comparisonRunning}
              onRunComparison={runComparisonNow}
            />
          </section>

          <div id="how">
            <HowItWorks />
          </div>

          <footer className="pb-8 text-center text-[11px] text-muted-foreground">
            Intelligent Traffic Signal Agent — fully client-side simulation. All numbers shown are measured
            from the running simulation, never assumed.
          </footer>
        </main>
      </div>
    </div>
  );
}
