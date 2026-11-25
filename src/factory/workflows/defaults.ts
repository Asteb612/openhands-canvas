import type { NodeType, WorkflowDefinition, WorkflowNode } from "../api";
import { factoryT, type FactoryKey } from "../i18n";

type T = (key: FactoryKey, vars?: Record<string, string | number>) => string;

/** English when the caller has no `t` (tests, non-UI helpers). */
const englishT: T = (key, vars) => factoryT("en", key, vars);

/** A valid starting configuration for each node type (palette drops). */
export function defaultConfig(
  type: NodeType,
  t: T = englishT,
): Record<string, unknown> {
  switch (type) {
    case "trigger":
      return {
        trigger: { kind: "label", label: "factory:ready" },
        filters: { mode: "all", conditions: [] },
      };
    case "agent":
      return {
        prompt: t("wfDefaultPrompt"),
        conversation: "ticket",
        stopChecks: [],
      };
    case "review":
      return { focus: ["correctness", "security"], blockOn: "important" };
    case "check":
      return { checks: [{ kind: "commits_ahead", min: 1 }] };
    case "command":
      return { commands: ["test"] };
    case "human":
      return {
        title: t("wfDefaultHumanTitle"),
        what: t("wfDefaultHumanWhat"),
        files: [],
        outcomes: [
          {
            id: "approve",
            label: t("wfDefaultApprove"),
            kind: "approve",
            requireComment: false,
          },
          {
            id: "changes",
            label: t("wfDefaultChanges"),
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
      return { text: t("wfDefaultNote"), to: "canvas" };
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

export function newNode(
  def: WorkflowDefinition,
  type: NodeType,
  t: T = englishT,
): WorkflowNode {
  return { id: uniqueNodeId(def, type), type, config: defaultConfig(type, t) };
}

/** Minimal valid workflow for a new, blank workflow. */
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

/** Short human summary of a node, shown on the card (technical values stay as they are). */
export function nodeSummary(n: WorkflowNode, t: T = englishT): string {
  const c = n.config as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (n.type) {
    case "trigger": {
      const tr = c.trigger ?? {};
      if (tr.kind === "label")
        return t("wfSumLabel", {
          label: tr.label,
          extra: tr.projectStatus ? ` + ${tr.projectStatus}` : "",
        });
      if (tr.kind === "project_status")
        return t("wfSumStatus", { status: tr.status });
      if (tr.kind === "comment_command") return `/factory run ${tr.command}`;
      if (tr.kind === "cron") return t("wfSumCron", { cron: tr.cron });
      if (tr.kind === "schedule")
        return t("wfSumSchedule", { cron: tr.cron, tz: tr.timezone ?? "" });
      if (tr.kind === "chain")
        return t("wfSumChain", {
          wf: tr.workflowId,
          result: tr.result ?? "completed",
        });
      return t("wfSumManual");
    }
    case "agent":
      return String(c.prompt ?? "").slice(0, 70);
    case "review":
      return (c.focus ?? []).join(", ");
    case "check":
      return (c.checks ?? []).map((x: { kind: string }) => x.kind).join(", ");
    case "command":
      return (c.commands ?? []).join(" → ");
    case "human":
      return String(c.title ?? "");
    case "router":
      return t("wfSumRoutes", { n: (c.routes ?? []).length });
    case "git":
      return String(c.action ?? "");
    case "wait":
      return c.for === "duration"
        ? t("minutes", { n: c.minutes })
        : String(c.for ?? "");
    case "note":
      return String(c.text ?? "").slice(0, 70);
    case "end":
      return String(c.result ?? "");
  }
}

/** i18n key of each node type's name. */
export const TYPE_LABEL: Record<NodeType, FactoryKey> = {
  trigger: "wfTypeTrigger",
  agent: "wfTypeAgent",
  review: "wfTypeReview",
  check: "wfTypeCheck",
  command: "wfTypeCommand",
  human: "wfTypeHuman",
  router: "wfTypeRouter",
  git: "wfTypeGit",
  wait: "wfTypeWait",
  note: "wfTypeNote",
  end: "wfTypeEnd",
};

/**
 * Raw colour of each node type, for the places React Flow needs a literal value
 * (minimap fill). Elsewhere use TYPE_COLOR, which follows the theme.
 */
export const TYPE_COLOR_HEX: Record<NodeType, string> = {
  trigger: "#22c55e",
  agent: "#8b5cf6",
  review: "#f97316",
  check: "#0ea5e9",
  command: "#0ea5e9",
  human: "#f59e0b",
  router: "#64748b",
  git: "#ec4899",
  wait: "#a3a3a3",
  note: "#a3a3a3",
  end: "#ef4444",
};

/** Theme token of each node type (CSS colour, hex fallback when the theme lacks it). */
const TYPE_TOKEN: Record<NodeType, string> = {
  trigger: "--color-markdown-alert-tip",
  agent: "--color-markdown-alert-important",
  review: "--color-markdown-alert-warning",
  check: "--color-markdown-alert-note",
  command: "--color-markdown-alert-note",
  human: "--color-markdown-alert-warning",
  router: "--color-muted",
  git: "--color-info",
  wait: "--color-text-tertiary",
  note: "--color-text-tertiary",
  end: "--color-markdown-alert-caution",
};

export const TYPE_COLOR: Record<NodeType, string> = Object.fromEntries(
  (Object.keys(TYPE_TOKEN) as NodeType[]).map((k) => [
    k,
    `var(${TYPE_TOKEN[k]}, ${TYPE_COLOR_HEX[k]})`,
  ]),
) as Record<NodeType, string>;
