import type { NodeType, WorkflowDefinition, WorkflowNode } from "./api";

/** A valid starting configuration for each node type (palette drops). */
export function defaultConfig(type: NodeType): Record<string, unknown> {
  switch (type) {
    case "trigger":
      return {
        trigger: { kind: "label", label: "factory:ready" },
        filters: { mode: "all", conditions: [] },
      };
    case "agent":
      return {
        prompt: "Décris ici ce que l’agent doit faire pour {{ticket.title}}.",
        conversation: "ticket",
      };
    case "check":
      return { checks: [{ kind: "commits_ahead", min: 1 }] };
    case "command":
      return { commands: ["test"] };
    case "human":
      return {
        title: "Validation",
        what: "le travail de l’agent",
        files: [],
        outcomes: [
          {
            id: "approve",
            label: "Valider",
            kind: "approve",
            requireComment: false,
          },
          {
            id: "changes",
            label: "Demander des changements",
            kind: "changes",
            requireComment: true,
          },
        ],
        quorum: 1,
        postFilesToIssue: true,
      };
    case "router":
      return {
        routes: [
          {
            port: "bug",
            when: {
              mode: "all",
              conditions: [{ field: "labels", op: "contains", value: "bug" }],
            },
          },
        ],
      };
    case "git":
      return { action: "draft_pr" };
    case "wait":
      return { for: "pr_merged" };
    case "note":
      return { text: "Étape terminée pour #{{ticket.issue}}.", to: "canvas" };
    case "end":
      return { result: "completed" };
  }
}

export function uniqueNodeId(def: WorkflowDefinition, type: NodeType): string {
  const taken = new Set(def.nodes.map((n) => n.id));
  for (let i = 1; ; i++) {
    const id = `${type}_${i}`;
    if (!taken.has(id)) return id;
  }
}

export function newNode(def: WorkflowDefinition, type: NodeType): WorkflowNode {
  return { id: uniqueNodeId(def, type), type, config: defaultConfig(type) };
}

/** Minimal valid workflow for "Nouveau". */
export function blankDefinition(name: string): WorkflowDefinition {
  return {
    schema: 1,
    name,
    description: "",
    nodes: [
      { id: "start", type: "trigger", config: defaultConfig("trigger") },
      { id: "done", type: "end", config: { result: "completed" } },
    ],
    edges: [{ from: "start", port: "out", to: "done" }],
    settings: {
      onExisting: "ignore",
      cancelOnLabelRemoved: true,
      cancelOnIssueClosed: true,
      speckit: false,
    },
    layout: {},
  };
}

/** Short human summary of a node, shown on the card. */
export function nodeSummary(n: WorkflowNode): string {
  const c = n.config as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (n.type) {
    case "trigger": {
      const t = c.trigger ?? {};
      if (t.kind === "label")
        return `label ${t.label}${t.projectStatus ? ` + ${t.projectStatus}` : ""}`;
      if (t.kind === "project_status") return `statut ${t.status}`;
      if (t.kind === "comment_command") return `/factory run ${t.command}`;
      if (t.kind === "cron") return `planning ${t.cron}`;
      if (t.kind === "chain")
        return `après ${t.workflowId} (${t.result ?? "completed"})`;
      return "manuel";
    }
    case "agent":
      return String(c.prompt ?? "").slice(0, 70);
    case "check":
      return (c.checks ?? []).map((x: { kind: string }) => x.kind).join(", ");
    case "command":
      return (c.commands ?? []).join(" → ");
    case "human":
      return String(c.title ?? "");
    case "router":
      return `${(c.routes ?? []).length} route(s)`;
    case "git":
      return String(c.action ?? "");
    case "wait":
      return c.for === "duration" ? `${c.minutes} min` : String(c.for ?? "");
    case "note":
      return String(c.text ?? "").slice(0, 70);
    case "end":
      return String(c.result ?? "");
  }
}

export const TYPE_COLOR: Record<NodeType, string> = {
  trigger: "#22c55e",
  agent: "#8b5cf6",
  check: "#0ea5e9",
  command: "#0ea5e9",
  human: "#f59e0b",
  router: "#64748b",
  git: "#ec4899",
  wait: "#a3a3a3",
  note: "#a3a3a3",
  end: "#ef4444",
};
