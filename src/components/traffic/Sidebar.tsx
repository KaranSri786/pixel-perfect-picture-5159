import { BarChart3, BookOpen, Brain, Radar, TrafficCone } from "lucide-react";

const NAV = [
  { id: "live", label: "Live Simulation", icon: Radar },
  { id: "ai", label: "AI Decisions", icon: Brain },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "how", label: "How It Works", icon: BookOpen },
];

export function Sidebar() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border/60 bg-sidebar p-4 md:flex">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15">
          <TrafficCone className="size-5 text-primary" aria-hidden />
        </div>
        <div>
          <div className="font-display text-sm font-bold leading-tight text-foreground">SignalWise</div>
          <div className="text-[10px] text-muted-foreground">Traffic Signal Agent</div>
        </div>
      </div>
      <nav className="mt-6 space-y-1" aria-label="Sections">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto rounded-lg border border-border/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <div className="mb-1 font-semibold text-foreground">Legend</div>
        <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--signal-green)]" /> Green — proceed</div>
        <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--signal-amber)]" /> Yellow — clear/stop</div>
        <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--signal-red)]" /> Red — stop line</div>
        <div className="mt-1.5 flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#e0a458]" /> Bus</div>
        <div className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#e5484d]" /> Emergency</div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <nav className="flex gap-2 overflow-x-auto md:hidden" aria-label="Sections">
      {NAV.map((item) => (
        <button
          key={item.id}
          onClick={() => scrollTo(item.id)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <item.icon className="size-3.5" aria-hidden />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
