/** Types of the factory orchestrator API (packages/orchestrator/src/api/routes.ts). */

export type NodeType =
  | "trigger"
  | "agent"
  | "review"
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
  /** Trigger configs of the latest version (cards, detail page). */
  triggers?: TriggerSummary[];
  /** Runs on a schedule, without a GitHub issue. */
  scheduled?: boolean;
  nextRunAt?: string | null;
  /** Project workflows: last 30 days and the last run. */
  activity?: WorkflowActivity | null;
}

export type TriggerSummary =
  | { kind: "label"; label: string; projectStatus?: string }
  | { kind: "project_status"; status: string }
  | { kind: "comment_command"; command: string }
  | { kind: "manual" }
  | { kind: "cron"; cron: string; timezone: string; issueTitle: string }
  | { kind: "schedule"; cron: string; timezone: string }
  | { kind: "chain"; workflowId: string; result: string };

export interface WorkflowActivity {
  runs: number;
  completed: number;
  failed: number;
  avgSeconds: number | null;
  last: { id: number; state: string; at: string; seconds: number };
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
  /** Set through PUT /projects/:id/docker (kept by the settings endpoint). */
  docker?: { sidecarMemory?: string; containerMemory?: string };
}

/** Docker resources of a project's agent pod (GET /projects/:id/docker). */
export interface ProjectDocker {
  enabled: boolean;
  /** The sidecar can be resized live (in a cluster, memMax set in the project file). */
  resizable: boolean;
  /** Terraform default (deploy.docker.memLimit) and the most Canvas may set (memMax). */
  default: string | null;
  max: string | null;
  sidecarMemory: string | null;
  containerMemory: string | null;
  containerMemoryDefault: string;
  live: {
    spec: string | null;
    applied: string | null;
    resize: {
      status: "pending" | "in_progress";
      reason?: string;
      message?: string;
    } | null;
  } | null;
  liveError: string | null;
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
  /** Names a command node may run. */
  commands: string[];
  /** The full catalogue (projects/<id>.yaml): how to install, test, run the project. */
  commandList?: ProjectCommand[];
  /** Docker daemon in the project's agent pod (Kata VM sidecar). */
  docker?: boolean;
  /** Dev stack preview for manual tests (deploy.preview): a path of the command center host. */
  preview?: { url: string; port: number } | null;
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
    issue: number | null;
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
    kind?: "issue" | "scheduled";
    issue: number | null;
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
  /** "scheduled": a scheduled workflow's run, without a GitHub issue. */
  kind?: "issue" | "scheduled";
  issue: number | null;
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

export type CommandKind = "setup" | "check" | "run" | "other";

export interface ProjectCommand {
  name: string;
  run: string;
  description: string;
  kind: CommandKind;
  timeoutSeconds: number;
  /** Why it cannot run in the agent pod; null when it can. */
  unavailable: string | null;
}
