import type { Direction, RouteEdge } from "./types";

/**
 * Road network for emergency routing: a 3x3 grid of junctions where the
 * centre junction (B2) is the simulated intersection. Junctions are nodes,
 * roads are edges, and edge weights are estimated travel times that grow
 * with congestion on the approaches to the centre junction.
 */
export interface Junction {
  id: string;
  col: number;
  row: number;
}

export interface RoadEdge {
  a: string;
  b: string;
  cost: number;
}

export const GRID_JUNCTIONS: Junction[] = [
  { id: "A1", col: 0, row: 0 },
  { id: "B1", col: 1, row: 0 },
  { id: "C1", col: 2, row: 0 },
  { id: "A2", col: 0, row: 1 },
  { id: "B2", col: 1, row: 1 },
  { id: "C2", col: 2, row: 1 },
  { id: "A3", col: 0, row: 2 },
  { id: "B3", col: 1, row: 2 },
  { id: "C3", col: 2, row: 2 },
];

export const CENTER_JUNCTION = "B2";

export interface EdgeCongestion {
  N: number;
  S: number;
  E: number;
  W: number;
}

/** Max extra cost added to a centre-adjacent edge at full congestion. */
const MAX_CONGESTION_PENALTY = 2;

export function buildEdges(congestion: EdgeCongestion): RoadEdge[] {
  const pairs: [string, string][] = [
    ["A1", "B1"], ["B1", "C1"],
    ["A2", "B2"], ["B2", "C2"],
    ["A3", "B3"], ["B3", "C3"],
    ["A1", "A2"], ["A2", "A3"],
    ["B1", "B2"], ["B2", "B3"],
    ["C1", "C2"], ["C2", "C3"],
  ];
  const centreApproach: Record<string, keyof EdgeCongestion | undefined> = {
    "A2|B2": "W", "B2|A2": "W",
    "C2|B2": "E", "B2|C2": "E",
    "B1|B2": "N", "B2|B1": "N",
    "B3|B2": "S", "B2|B3": "S",
  };
  return pairs.map(([a, b]) => {
    const approach = centreApproach[`${a}|${b}`];
    const penalty = approach ? Math.min(MAX_CONGESTION_PENALTY, 0.15 * congestion[approach]) : 0;
    return { a, b, cost: 1 + penalty };
  });
}

export interface AStarResult {
  path: string[];
  cost: number;
  expanded: number;
}

/**
 * A* over the junction grid.
 *   f(n) = g(n) + h(n)
 * g(n): accumulated travel cost from the start junction.
 * h(n): Manhattan distance to the goal times the minimum edge cost (1),
 *       which is admissible because every edge costs at least 1.
 */
export function aStar(edges: RoadEdge[], start: string, goal: string): AStarResult | null {
  const pos = new Map(GRID_JUNCTIONS.map((j) => [j.id, j]));
  const adjacency = new Map<string, { to: string; cost: number }[]>();
  for (const e of edges) {
    if (!adjacency.has(e.a)) adjacency.set(e.a, []);
    if (!adjacency.has(e.b)) adjacency.set(e.b, []);
    adjacency.get(e.a)!.push({ to: e.b, cost: e.cost });
    adjacency.get(e.b)!.push({ to: e.a, cost: e.cost });
  }
  const goalPos = pos.get(goal);
  if (!goalPos || !pos.has(start)) return null;

  const heuristic = (id: string): number => {
    const p = pos.get(id)!;
    return Math.abs(p.col - goalPos.col) + Math.abs(p.row - goalPos.row);
  };

  const gScore = new Map<string, number>([[start, 0]]);
  const cameFrom = new Map<string, string>();
  const open: { id: string; f: number }[] = [{ id: start, f: heuristic(start) }];
  const closed = new Set<string>();
  let expanded = 0;

  while (open.length > 0) {
    open.sort((x, y) => x.f - y.f);
    const current = open.shift()!;
    if (closed.has(current.id)) continue;
    closed.add(current.id);
    expanded++;
    if (current.id === goal) {
      const path = [goal];
      let node = goal;
      while (cameFrom.has(node)) {
        node = cameFrom.get(node)!;
        path.unshift(node);
      }
      return { path, cost: gScore.get(goal)!, expanded };
    }
    for (const neighbour of adjacency.get(current.id) ?? []) {
      if (closed.has(neighbour.to)) continue;
      const tentative = gScore.get(current.id)! + neighbour.cost;
      if (tentative < (gScore.get(neighbour.to) ?? Infinity)) {
        gScore.set(neighbour.to, tentative);
        cameFrom.set(neighbour.to, current.id);
        open.push({ id: neighbour.to, f: tentative + heuristic(neighbour.to) });
      }
    }
  }
  return null;
}

/** Which approach a vehicle enters the centre junction from, given the previous junction. */
export function approachForEntry(entryNodeId: string): Direction | null {
  const map: Record<string, Direction | undefined> = { B1: "N", B3: "S", A2: "W", C2: "E" };
  return map[entryNodeId] ?? null;
}

export function buildNetworkEdges(edges: RoadEdge[], path: string[]): RouteEdge[] {
  const onPath = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) {
    onPath.add(`${path[i]}|${path[i + 1]}`);
    onPath.add(`${path[i + 1]}|${path[i]}`);
  }
  return edges.map((e) => ({
    a: e.a,
    b: e.b,
    cost: Math.round(e.cost * 100) / 100,
    onPath: onPath.has(`${e.a}|${e.b}`),
  }));
}
