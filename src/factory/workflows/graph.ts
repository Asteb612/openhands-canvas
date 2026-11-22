import dagre from "@dagrejs/dagre";
import type { Edge as FlowEdge, Node as FlowNode } from "@xyflow/react";
import type {
  Problem,
  ValidationResponse,
  WorkflowDefinition,
  WorkflowNode,
} from "./api";

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 96;

export interface WorkflowNodeData extends Record<string, unknown> {
  node: WorkflowNode;
  /** Output ports from the server (engine rules); fallback: ports used by edges. */
  ports: string[];
  optional: string[];
  problems: string[];
  /** Number of runs currently on this node (run overlay). */
  runs: number;
  readOnly: boolean;
}

export type WorkflowFlowNode = FlowNode<WorkflowNodeData, "workflow">;

export interface RoutedEdgeData extends Record<string, unknown> {
  obstacles: Box[];
  sourceBox?: Box;
  targetBox?: Box;
  lane: number;
  problem: boolean;
}

/** Ports of a node: the server's answer when known, else what the edges use. */
export function portsOf(
  def: WorkflowDefinition,
  id: string,
  ports: ValidationResponse["ports"] | undefined,
): { ports: string[]; optional: string[] } {
  const known = ports?.[id];
  if (known) return known;
  const used = [
    ...new Set(def.edges.filter((e) => e.from === id).map((e) => e.port)),
  ];
  const node = def.nodes.find((n) => n.id === id);
  return {
    ports: node?.type === "end" ? [] : used.length ? used : ["out"],
    optional: [],
  };
}

/** Positions for nodes without one in `def.layout` (left-to-right). */
export function autoLayout(
  def: WorkflowDefinition,
  force = false,
): Record<string, { x: number; y: number }> {
  const missing = def.nodes.some((n) => !def.layout[n.id]);
  if (!force && !missing) return def.layout;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 56, ranksep: 120 }); // room for routed links and labels
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of def.nodes)
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of def.edges) {
    if (g.hasNode(e.from) && g.hasNode(e.to)) g.setEdge(e.from, e.to);
  }
  dagre.layout(g);
  const out: Record<string, { x: number; y: number }> = force
    ? {}
    : { ...def.layout };
  for (const n of def.nodes) {
    if (!force && out[n.id]) continue;
    const p = g.node(n.id);
    out[n.id] = {
      x: Math.round(p.x - NODE_WIDTH / 2),
      y: Math.round(p.y - NODE_HEIGHT / 2),
    };
  }
  return out;
}

export function problemsByNode(problems: Problem[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const p of problems) {
    const id = p.node ?? p.edge?.from;
    if (!id) continue;
    m.set(id, [...(m.get(id) ?? []), p.message]);
  }
  return m;
}

export function toFlow(
  def: WorkflowDefinition,
  opts: {
    ports?: ValidationResponse["ports"];
    problems?: Problem[];
    runsByNode?: Map<string, number>;
    readOnly: boolean;
    /** Rendered sizes (React Flow measurements) for exact routing. */
    sizes?: Record<string, { width: number; height: number }>;
  },
): { nodes: WorkflowFlowNode[]; edges: FlowEdge<RoutedEdgeData>[] } {
  const layout = autoLayout(def);
  const probs = problemsByNode(opts.problems ?? []);
  const nodes: WorkflowFlowNode[] = def.nodes.map((n) => {
    const p = portsOf(def, n.id, opts.ports);
    return {
      id: n.id,
      type: "workflow",
      position: layout[n.id] ?? { x: 0, y: 0 },
      deletable: !opts.readOnly,
      draggable: !opts.readOnly,
      data: {
        node: n,
        ports: p.ports,
        optional: p.optional,
        problems: probs.get(n.id) ?? [],
        runs: opts.runsByNode?.get(n.id) ?? 0,
        readOnly: opts.readOnly,
      },
    };
  });
  const edgeProblems = new Set(
    (opts.problems ?? [])
      .filter((p) => p.edge)
      .map((p) => `${p.edge!.from}:${p.edge!.port}`),
  );
  const boxes: Box[] = nodes.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    w: opts.sizes?.[n.id]?.width ?? NODE_WIDTH,
    h: opts.sizes?.[n.id]?.height ?? estimateHeight(n.data.ports.length),
  }));
  const boxById = new Map(boxes.map((b) => [b.id, b]));
  // Lanes for links that need a corridor (loops, or a node in the way), shortest
  // first so they stay inside the longer ones.
  const approx = def.edges.map((e) => {
    const sb = boxById.get(e.from);
    const tb = boxById.get(e.to);
    if (!sb || !tb) return { e, corridor: false, span: 0 };
    const sp = { x: sb.x + sb.w, y: sb.y + sb.h / 2 };
    const tp = { x: tb.x, y: tb.y + tb.h / 2 };
    const others = boxes.filter((b) => b.id !== e.from && b.id !== e.to);
    const route = routeEdge(sp, tp, others, 0, { source: sb, target: tb });
    return { e, corridor: route.length > 4, span: Math.abs(tp.x - sp.x) };
  });
  const lanes = new Map<string, number>();
  approx
    .filter((a) => a.corridor)
    .sort((a, b) => a.span - b.span)
    .forEach((a, i) => lanes.set(edgeId(a.e.from, a.e.port), i));
  const edges: FlowEdge<RoutedEdgeData>[] = def.edges.map((e) => ({
    id: edgeId(e.from, e.port),
    source: e.from,
    sourceHandle: e.port,
    target: e.to,
    type: "routed",
    label: e.port,
    deletable: !opts.readOnly,
    data: {
      obstacles: boxes.filter((b) => b.id !== e.from && b.id !== e.to),
      sourceBox: boxById.get(e.from),
      targetBox: boxById.get(e.to),
      lane: lanes.get(edgeId(e.from, e.port)) ?? 0,
      problem: edgeProblems.has(`${e.from}:${e.port}`),
    },
  }));
  return { nodes, edges };
}

/** One edge per output port: the id is the port's identity. */
export function edgeId(from: string, port: string): string {
  return `${from}::${port}`;
}

/** Renames a node everywhere (edges, layout). */
export function renameNode(
  def: WorkflowDefinition,
  from: string,
  to: string,
): WorkflowDefinition {
  const layout = { ...def.layout };
  if (layout[from]) {
    layout[to] = layout[from]!;
    delete layout[from];
  }
  return {
    ...def,
    nodes: def.nodes.map((n) => (n.id === from ? { ...n, id: to } : n)),
    edges: def.edges.map((e) => ({
      ...e,
      from: e.from === from ? to : e.from,
      to: e.to === from ? to : e.to,
    })),
    layout,
  };
}

// ------------------------------------------------------------------ edge routing
// Orthogonal routes computed from node boxes, so links never cross a node:
// direct 3-segment path when free, otherwise through a corridor above/below the
// nodes in the way (loops go below), one lane per corridor link.

export interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}

const GAP = 22; // horizontal stub out of a handle
const MARGIN = 10; // clearance around nodes
const LANE = 14; // spacing between parallel corridors

/** Estimated rendered height of a node card (measured sizes win when known). */
export function estimateHeight(ports: number): number {
  return 84 + ports * 17;
}

function hitsBox(a: Point, b: Point, box: Box): boolean {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  return (
    x2 > box.x - MARGIN &&
    x1 < box.x + box.w + MARGIN &&
    y2 > box.y - MARGIN &&
    y1 < box.y + box.h + MARGIN
  );
}

function pathIsFree(points: Point[], boxes: Box[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    for (const b of boxes)
      if (hitsBox(points[i]!, points[i + 1]!, b)) return false;
  }
  return true;
}

/**
 * Route from a source handle (right side) to a target handle (left side).
 * `boxes` excludes the source and target nodes; `lane` separates corridor links.
 */
export function routeEdge(
  s: Point,
  t: Point,
  boxes: Box[],
  lane = 0,
  ends: { source?: Box; target?: Box } = {},
): Point[] {
  const out = s.x + GAP;
  const inn = t.x - GAP;
  if (inn > out) {
    // Forward: try a vertical segment at a few x positions between the nodes.
    const candidates = [(out + inn) / 2, out, inn];
    for (let i = 1; i < 6; i++) candidates.push(out + ((inn - out) * i) / 6);
    for (const mx of candidates) {
      const p = [s, { x: mx, y: s.y }, { x: mx, y: t.y }, t];
      if (
        Math.abs(s.y - t.y) < 1
          ? pathIsFree([s, t], boxes)
          : pathIsFree(p, boxes)
      ) {
        return Math.abs(s.y - t.y) < 1 ? [s, t] : p;
      }
    }
  }
  // Corridor above or below everything between the two ends (loops: below).
  const x1 = Math.min(out, inn) - MARGIN;
  const x2 = Math.max(out, inn) + MARGIN;
  const span = [
    ...boxes,
    ...(ends.source ? [ends.source] : []),
    ...(ends.target ? [ends.target] : []),
  ].filter((b) => b.x + b.w > x1 && b.x < x2);
  const top = Math.min(s.y, t.y, ...span.map((b) => b.y));
  const bottom = Math.max(s.y, t.y, ...span.map((b) => b.y + b.h));
  const below = bottom + MARGIN * 2 + lane * LANE;
  const above = top - MARGIN * 2 - lane * LANE;
  const back = inn <= out;
  const yc =
    back ||
    Math.abs(below - (s.y + t.y) / 2) <= Math.abs(above - (s.y + t.y) / 2)
      ? below
      : above;
  const ox = out + (back ? lane * 4 : 0);
  const ix = inn - (back ? lane * 4 : 0);
  return [
    s,
    { x: ox, y: s.y },
    { x: ox, y: yc },
    { x: ix, y: yc },
    { x: ix, y: t.y },
    t,
  ];
}

/** SVG path through orthogonal points with rounded corners, and a label anchor. */
export function roundedPath(
  points: Point[],
  radius = 8,
): { d: string; label: Point } {
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i - 1]!;
    const c = points[i]!;
    const n = points[i + 1]!;
    const r = Math.min(
      radius,
      Math.hypot(c.x - p.x, c.y - p.y) / 2,
      Math.hypot(n.x - c.x, n.y - c.y) / 2,
    );
    const a = {
      x: c.x + (Math.sign(p.x - c.x) * r || 0),
      y: c.y + (Math.sign(p.y - c.y) * r || 0),
    };
    const b = {
      x: c.x + (Math.sign(n.x - c.x) * r || 0),
      y: c.y + (Math.sign(n.y - c.y) * r || 0),
    };
    d += ` L ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  // Label on the longest horizontal segment (readable), else the longest one.
  let best = { len: -1, at: points[0]! };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) * (a.y === b.y ? 2 : 1);
    if (len > best.len)
      best = { len, at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }
  return { d, label: best.at };
}
