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
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 90 });
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
  },
): { nodes: WorkflowFlowNode[]; edges: FlowEdge[] } {
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
  const edges: FlowEdge[] = def.edges.map((e) => ({
    id: edgeId(e.from, e.port),
    source: e.from,
    sourceHandle: e.port,
    target: e.to,
    label: e.port,
    deletable: !opts.readOnly,
    animated: false,
    style: edgeProblems.has(`${e.from}:${e.port}`)
      ? { stroke: "#ef4444" }
      : undefined,
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
