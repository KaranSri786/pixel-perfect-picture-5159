import { BarChart3, Play, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ComparisonResult } from "@/simulation/comparison";
import { SIM_CONFIG } from "@/simulation/config";
import type { MetricsSample } from "@/simulation/types";

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--popover-foreground)",
  fontSize: 12,
} as const;

const axisProps = {
  stroke: "var(--muted-foreground)",
  tickFontSize: 11,
} as const;

function ChartCard({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
      {note ? <p className="mb-2 text-[11px] text-muted-foreground">{note}</p> : <div className="mb-2" />}
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      Run the simulation to collect data.
    </div>
  );
}

interface Props {
  history: MetricsSample[];
  comparison: ComparisonResult | null;
  comparisonRunning: boolean;
  onRunComparison: () => void;
}

export function AnalyticsPanel({ history, comparison, comparisonRunning, onRunComparison }: Props) {
  const hasData = history.length > 1;
  const latest = history[history.length - 1];

  const comparisonData = comparison
    ? [
        { metric: "Avg wait (s)", Fixed: round1(comparison.fixed.avgWait), Intelligent: round1(comparison.intelligent.avgWait) },
        { metric: "Avg queue", Fixed: round1(comparison.fixed.avgQueue), Intelligent: round1(comparison.intelligent.avgQueue) },
        { metric: "Max queue", Fixed: comparison.fixed.maxQueue, Intelligent: comparison.intelligent.maxQueue },
        { metric: "Throughput (veh/min)", Fixed: round1(comparison.fixed.throughput), Intelligent: round1(comparison.intelligent.throughput) },
        { metric: "Emergency wait (s)", Fixed: round1(comparison.fixed.emergencyAvgWait), Intelligent: round1(comparison.intelligent.emergencyAvgWait) },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Average waiting time over time" note="Green line: vehicles waiting right now · Blue line: overall average of served vehicles">
          {hasData ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(s: number) => `${Math.round(s)}s`} {...axisProps} />
                <YAxis unit="s" {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="stoppedAvgWait" name="Waiting now" stroke="var(--chart-1)" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="overallAvgWait" name="Overall avg" stroke="var(--chart-3)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Queue length by direction" note="Vehicles currently stopped at each approach">
          {latest ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={[
                { dir: "North", queue: latest.queueN },
                { dir: "South", queue: latest.queueS },
                { dir: "East", queue: latest.queueE },
                { dir: "West", queue: latest.queueW },
              ]} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="dir" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="queue" name="Queued vehicles" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Vehicles served over time">
          {hasData ? (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(s: number) => `${Math.round(s)}s`} {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="served" name="Vehicles served" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.25} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Traffic density over time" note="Share of road capacity occupied by vehicles">
          {hasData ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(s: number) => `${Math.round(s)}s`} {...axisProps} />
                <YAxis unit="%" tickFormatter={(v: number) => `${Math.round(v * 100)}`} {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${Math.round(v * 100)}%`} />
                <Line type="monotone" dataKey="density" name="Density" stroke="var(--chart-5)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <BarChart3 className="size-4 text-primary" aria-hidden />
          <h3 className="font-display text-sm font-semibold text-foreground">
            Fixed-Time vs Intelligent-Agent comparison
          </h3>
          <button
            onClick={onRunComparison}
            disabled={comparisonRunning}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {comparisonRunning ? <RefreshCw className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {comparisonRunning ? "Running both tests…" : "Run Comparison"}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Both controllers run {SIM_CONFIG.comparisonDuration}s of simulated traffic with the same random seed
          (seed {comparison?.seed ?? SIM_CONFIG.defaultSeed}), the same arrival sequence and an emergency
          vehicle at {SIM_CONFIG.emergencySpawnTime}s. Results are measured, not assumed.
        </p>

        {!comparison ? (
          <div className="mt-3 flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            {comparisonRunning ? "Running comparison…" : "No comparison results yet."}
          </div>
        ) : (
          <>
            <div
              className={`mt-3 rounded-lg border p-3 text-sm font-medium ${
                comparison.winner === "intelligent"
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : comparison.winner === "fixed"
                    ? "border-accent/40 bg-accent/10 text-foreground"
                    : "border-border bg-secondary/40 text-foreground"
              }`}
            >
              {comparison.winner === "intelligent" ? (
                <>
                  The Intelligent Agent reduced average waiting time by{" "}
                  <span className="font-display font-bold text-primary tabular-nums">
                    {comparison.reductionPct.toFixed(1)}%
                  </span>{" "}
                  vs Fixed-Time control in this test.
                </>
              ) : comparison.winner === "fixed" ? (
                <>
                  Fixed-Time control performed better in this test: average waiting time was{" "}
                  <span className="font-display font-bold tabular-nums">
                    {Math.abs(comparison.reductionPct).toFixed(1)}%
                  </span>{" "}
                  lower than the Intelligent Agent.
                </>
              ) : (
                <>Both controllers performed within 0.15s of each other in this test.</>
              )}
            </div>

            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Metric</th>
                      <th className="pb-2 text-right font-medium">Fixed-Time</th>
                      <th className="pb-2 text-right font-medium">Intelligent</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {[
                      ["Average waiting time", `${comparison.fixed.avgWait.toFixed(1)}s`, `${comparison.intelligent.avgWait.toFixed(1)}s`],
                      ["Average queue length", comparison.fixed.avgQueue.toFixed(1), comparison.intelligent.avgQueue.toFixed(1)],
                      ["Maximum queue length", String(comparison.fixed.maxQueue), String(comparison.intelligent.maxQueue)],
                      ["Vehicles served", String(comparison.fixed.served), String(comparison.intelligent.served)],
                      ["Throughput (veh/min)", comparison.fixed.throughput.toFixed(1), comparison.intelligent.throughput.toFixed(1)],
                      ["Emergency avg wait", `${comparison.fixed.emergencyAvgWait.toFixed(1)}s`, `${comparison.intelligent.emergencyAvgWait.toFixed(1)}s`],
                      ["Simulation duration", `${comparison.duration}s`, `${comparison.duration}s`],
                    ].map(([label, a, b]) => (
                      <tr key={label} className="border-t border-border/60">
                        <td className="py-1.5 text-foreground/90">{label}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{a}</td>
                        <td className="py-1.5 text-right font-semibold text-foreground">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={comparisonData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="metric" tick={{ fontSize: 9 }} interval={0} stroke="var(--muted-foreground)" />
                  <YAxis {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Fixed" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Intelligent" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
