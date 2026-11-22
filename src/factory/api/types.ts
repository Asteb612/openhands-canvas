/** Types of the factory orchestrator API (packages/orchestrator/src/api/routes.ts). */

export type NodeType =
  | "trigger"
  | "agent"
  | "check"
  | "command"
  | "human"
  | "router"
  | "git"
  | "wait"
  | "note"
  | "end";

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label?: string;
  maxVisits?: number;
  board?: string;
  timeoutMinutes?: number;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  port: string;
  to: string;
}

export interface WorkflowDefinition {
  schema: 1;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  settings: {
    onExisting: "ignore" | "restart";
    cancelOnLabelRemoved: boolean;
    cancelOnIssueClosed: boolean;
    speckit: boolean;
  };
  layout: Record<string, { x: number; y: number }>;
}

export interface WorkflowSummary {
  /** "template" (shared library) or the project id. */
  scope: string;
  id: string;
  /** Differs from its origin (edited built-in template / project copy edited since). */
  customised?: boolean;
  /** Project copy: the template it came from ("<templateId>@<version>"). */
  source?: string | null;
  /** Project copy: a newer version of its template is available. */
  templateUpdate?: { templateId: string; from: number; to: number } | null;
  name: string;
  description: string;
  builtin: boolean;
  archived: boolean;
  latestVersion: number;
  updatedAt: string;
}

export interface WorkflowVersion {
  version: number;
  createdBy: string;
  comment: string;
  createdAt: string;
}

export interface Problem {
  node?: string;
  edge?: { from: string; port: string };
  message: string;
}

export interface ValidationResponse {
  ok: boolean;
  problems: Problem[];
  ports: Record<string, { ports: string[]; optional: string[] }>;
}

export interface CatalogEntry {
  type: NodeType;
  label: string;
  family: string;
  description: string;
}

export interface NodeTypesResponse {
  catalog: CatalogEntry[];
  templateVars: readonly string[];
  conditionFields: readonly string[];
}

export const NOTIFY_KINDS = ["human", "failed", "quota", "completed"] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];

/** Dashboard column: a run goes to the first column whose filters all match. */
export interface BoardColumn {
  id: string;
  title: string;
  hint?: string;
  /** Run states (empty = any). */
  states?: string[];
  /** "workflowId/nodeId" or "*\/nodeId" (empty = any). */
  nodes?: string[];
  nodeTypes?: string[];
}

export interface ProjectPause {
  by: string;
  at: string;
  reason: string;
}

export interface ProjectSettings {
  notify: { events: NotifyKind[]; topicEnv?: string };
  paused?: ProjectPause | null;
  columns?: BoardColumn[];
}

export interface FactoryProject {
  id: string;
  name: string;
  repo: string | null;
  /** ok: running; inactive: `active: false` in its file; error: left out (see `error`). */
  status: "ok" | "inactive" | "error";
  error: string | null;
  active: boolean;
  subscription: string | null;
  paused: ProjectPause | null;
  /** Canvas backend of the project's Agent Server in the command center. */
  backend: { id: string; path: string };
  defaultWorkflow: string | null;
  enabledWorkflows: string[];
  commands: string[];
  settings?: ProjectSettings;
  config?: {
    defaultBranch: string;
    concurrency: number;
    labels: Record<string, unknown>;
    githubProject: boolean;
  } | null;
}

export interface SubscriptionStatus {
  id: string;
  label: string;
  projects: string[];
  suspendedUntil: string | null;
  last: {
    at: string;
    message: string;
    project: string;
    issue: number;
    until: string;
  } | null;
}

export interface FactoryStatus {
  control: {
    paused: boolean;
    by: string | null;
    at: string | null;
    reason: string;
  };
  subscriptions: SubscriptionStatus[];
  projects: {
    id: string;
    status: FactoryProject["status"];
    paused: ProjectPause | null;
    active: number;
    concurrency: number;
  }[];
  push: boolean;
  capacity: { global: number | null; active: number };
}

export interface ReviewData {
  run: {
    id: number;
    project: string;
    issue: number;
    title: string;
    prNumber: number | null;
    conversationId: string | null;
    workflow: string;
  };
  node: {
    id: string;
    label: string;
    title: string;
    what: string;
    instructions: string;
    outcomes: {
      id: string;
      label: string;
      kind: string;
      requireComment: boolean;
    }[];
  };
  files: { path: string; content: string | null; truncated: boolean }[];
}

export interface NodeStats {
  node: string;
  entries: number;
  runs: number;
  medianSeconds: number | null;
  avgSeconds: number | null;
  maxSeconds: number | null;
  loops: number;
  failedHere: number;
  activeHere: number;
}

export interface WorkflowStats {
  runs: number;
  byState: Record<string, number>;
  medianCompletedSeconds: number | null;
  nodes: NodeStats[];
}

export interface FactoryRun {
  id: number;
  project: string;
  issue: number;
  title: string;
  state: string;
  workflow: string;
  version: number;
  node: string | null;
  prNumber: number | null;
  conversationId: string | null;
  updatedAt: string;
  workflowName?: string;
  nodeLabel?: string | null;
  nodeType?: string | null;
  repo?: string | null;
  priority?: number;
  labels?: string[];
  branch?: string | null;
  failureMessage?: string | null;
  nodeEnteredAt?: string | null;
  createdAt?: string;
}

/** Where workflows live: the shared template library, or one project's own workflows. */
export type WorkflowScope =
  { kind: "template" } | { kind: "project"; project: string };

export const TEMPLATE_SCOPE: WorkflowScope = { kind: "template" };
