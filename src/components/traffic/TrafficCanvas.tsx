import { useEffect, useRef } from "react";

import type { TrafficSimulation } from "@/simulation/simulation";
import type { Direction, SignalLightState, Vehicle } from "@/simulation/types";

/**
 * Canvas renderer. It only READS simulation state each frame — all traffic
 * logic lives in src/simulation, never here.
 */

const C = {
  bg: "#0a0e17",
  block: "#101624",
  blockDetail: "#182238",
  road: "#1d2433",
  roadEdge: "#2c3547",
  intersection: "#242c40",
  laneMark: "#77809a",
  stopLine: "#dfe6f2",
  crosswalk: "#6f7a94",
  green: "#3ddc84",
  yellow: "#ffd23f",
  red: "#ff5c5c",
  lamp: "#2a3346",
  text: "#aab4c8",
  chip: "#0d1220",
};

const CAR_COLORS = ["#5b8def", "#48b5a6", "#9d7bd8", "#c7cfdd", "#d99a5b", "#7d8ba1", "#c96f6f"];

const CENTER = 400;
/** Stop-line position of a vehicle's centre, along its travel axis. */
const STOP = { N: 360, S: 440, E: 440, W: 360 } as const;
/** Lane centre coordinate: x for N/S approaches, y for E/W approaches. */
const LANE = { N: 386, S: 414, E: 386, W: 414 } as const;

const BUILDINGS: [number, number, number, number][] = [
  [24, 24, 120, 90], [168, 40, 90, 130], [40, 150, 110, 110], [190, 200, 130, 80],
  [452, 24, 110, 100], [590, 40, 140, 120], [470, 160, 90, 120], [610, 200, 110, 90],
  [24, 452, 120, 110], [180, 470, 100, 140], [40, 600, 130, 100], [200, 630, 110, 90],
  [460, 452, 130, 100], [620, 470, 110, 130], [480, 600, 100, 110], [620, 630, 120, 100],
];

function vehicleXY(v: Vehicle): { x: number; y: number } {
  switch (v.dir) {
    case "N": return { x: LANE.N, y: STOP.N - v.pos };
    case "S": return { x: LANE.S, y: STOP.S + v.pos };
    case "E": return { x: STOP.E + v.pos, y: LANE.E };
    case "W": return { x: STOP.W - v.pos, y: LANE.W };
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawVehicle(ctx: CanvasRenderingContext2D, v: Vehicle, now: number) {
  const { x, y } = vehicleXY(v);
  const vertical = v.dir === "N" || v.dir === "S";
  const len = v.length;
  const wid = v.type === "bus" ? 14 : 12;
  ctx.save();
  ctx.translate(x, y);
  if (!vertical) ctx.rotate(Math.PI / 2);
  ctx.fillStyle =
    v.type === "bus" ? C.yellow : v.type === "emergency" ? "#e5484d" : CAR_COLORS[v.id % CAR_COLORS.length];
  roundRect(ctx, -wid / 2, -len / 2, wid, len, 3);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(-wid / 2 + 2, -2, wid - 4, 4);
  if (v.type === "emergency") {
    const flash = Math.floor(now / 160) % 2 === 0;
    ctx.fillStyle = flash ? "#ff8a8a" : "#9ec1ff";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawSignalHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, state: SignalLightState) {
  ctx.fillStyle = C.chip;
  ctx.strokeStyle = C.roadEdge;
  ctx.lineWidth = 2;
  roundRect(ctx, cx - 9, cy - 22, 18, 44, 5);
  ctx.fill();
  ctx.stroke();
  const lamps: [SignalLightState, string, number][] = [
    ["red", C.red, -13],
    ["yellow", C.yellow, 0],
    ["green", C.green, 13],
  ];
  for (const [name, color, dy] of lamps) {
    const lit = state === name;
    ctx.beginPath();
    ctx.arc(cx, cy + dy, 5, 0, Math.PI * 2);
    if (lit) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 9;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = C.lamp;
      ctx.fill();
    }
  }
}

function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.font = "600 11px 'Space Grotesk', sans-serif";
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = C.chip;
  ctx.strokeStyle = C.roadEdge;
  roundRect(ctx, x - w / 2, y - 9, w, 18, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
}

function drawSim(sim: TrafficSimulation | null, ctx: CanvasRenderingContext2D, now: number) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, 800, 800);
  if (!sim) return;

  const lights = sim.lights;

  // City blocks
  for (const [bx, by] of [[0, 0], [428, 0], [0, 428], [428, 428]] as const) {
    ctx.fillStyle = C.block;
    ctx.fillRect(bx, by, 372, 372);
  }
  ctx.fillStyle = C.blockDetail;
  for (const [x, y, w, h] of BUILDINGS) ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (const [x, y, w] of BUILDINGS) ctx.fillRect(x, y, w, 3);

  // Roads
  ctx.fillStyle = C.road;
  ctx.fillRect(0, CENTER - 28, 800, 56);
  ctx.fillRect(CENTER - 28, 0, 56, 800);

  // Intersection surface
  ctx.fillStyle = C.intersection;
  ctx.fillRect(CENTER - 28, CENTER - 28, 56, 56);

  // Road edges
  ctx.strokeStyle = C.roadEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, CENTER - 28); ctx.lineTo(800, CENTER - 28);
  ctx.moveTo(0, CENTER + 28); ctx.lineTo(800, CENTER + 28);
  ctx.moveTo(CENTER - 28, 0); ctx.lineTo(CENTER - 28, 800);
  ctx.moveTo(CENTER + 28, 0); ctx.lineTo(CENTER + 28, 800);
  ctx.stroke();

  // Dashed lane centre-lines
  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = C.laneMark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CENTER, 0); ctx.lineTo(CENTER, CENTER - 34);
  ctx.moveTo(CENTER, CENTER + 34); ctx.lineTo(CENTER, 800);
  ctx.moveTo(0, CENTER); ctx.lineTo(CENTER - 34, CENTER);
  ctx.moveTo(CENTER + 34, CENTER); ctx.lineTo(800, CENTER);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crosswalks (zebra)
  ctx.fillStyle = C.crosswalk;
  for (let i = 0; i < 5; i++) {
    const offset = -20 + i * 9;
    ctx.fillRect(CENTER - 26, 338 + i * 0, 0, 0); // no-op guard
  }
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(376 + i * 10, 340, 5, 20);          // north approach
    ctx.fillRect(376 + i * 10, 440, 5, 20);          // south approach
    ctx.fillRect(340, 376 + i * 10, 20, 5);          // west approach
    ctx.fillRect(440, 376 + i * 10, 20, 5);          // east approach
  }

  // Stop lines
  ctx.fillStyle = C.stopLine;
  ctx.fillRect(CENTER - 28, 366, 28, 5);  // N lane
  ctx.fillRect(CENTER, 429, 28, 5);       // S lane
  ctx.fillRect(429, CENTER - 28, 5, 28);  // E lane
  ctx.fillRect(366, CENTER, 5, 28);       // W lane

  // Direction labels
  ctx.fillStyle = C.text;
  ctx.font = "600 15px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", LANE.N, 22);
  ctx.fillText("S", LANE.S, 778);
  ctx.fillText("E", 778, LANE.E);
  ctx.fillText("W", 22, LANE.W);

  // Signal heads
  drawSignalHead(ctx, 346, 336, lights.N);
  drawSignalHead(ctx, 454, 464, lights.S);
  drawSignalHead(ctx, 464, 346, lights.E);
  drawSignalHead(ctx, 336, 454, lights.W);

  // Queue count chips
  const counts = sim.queueCounts();
  const chipColor = (d: Direction): string =>
    lights[d] === "green" ? C.green : lights[d] === "yellow" ? C.yellow : C.red;
  drawChip(ctx, LANE.N, 58, `N ${counts.N}`, chipColor("N"));
  drawChip(ctx, LANE.S, 742, `S ${counts.S}`, chipColor("S"));
  drawChip(ctx, 742, LANE.E, `E ${counts.E}`, chipColor("E"));
  drawChip(ctx, 58, LANE.W, `W ${counts.W}`, chipColor("W"));

  // Vehicles
  for (const v of sim.vehicles.vehicles) drawVehicle(ctx, v, now);

  // Emergency marker
  const e = sim.emergency;
  if (e && !e.cleared) {
    const pulse = 12 + 4 * Math.sin(now / 180);
    const point = { N: { x: LANE.N, y: 96 }, S: { x: LANE.S, y: 704 }, E: { x: 704, y: LANE.E }, W: { x: 96, y: LANE.W } }[e.approach];
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    drawChip(ctx, point.x, point.y - 24, "EMS", C.red);
  }
}

export function TrafficCanvas({ getSim }: { getSim: () => TrafficSimulation | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getSimRef = useRef(getSim);
  getSimRef.current = getSim;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      drawSim(getSimRef.current(), ctx, now);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={800}
      role="img"
      aria-label="Live animated four-way traffic intersection with signal lights and vehicles"
      className="w-full h-auto rounded-2xl border border-border/60 bg-background"
    />
  );
}
