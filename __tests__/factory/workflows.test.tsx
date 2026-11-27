import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FactoryProject,
  WorkflowDefinition,
  WorkflowSummary,
} from "#/factory/api";
import {
  autoLayout,
  renameNode,
  roundedPath,
  routeEdge,
  toFlow,
} from "#/factory/workflows/graph";
import { blankDefinition, newNode } from "#/factory/workflows/defaults";
import { MemoryRouter, Route, Routes } from "react-router";
import WorkflowListPage from "#/factory/workflows/workflow-list-page";
import WorkflowDetailPage from "#/factory/workflows/workflow-detail-page";
import WorkflowEditPage from "#/factory/workflows/workflow-edit-page";

// The active project (= Canvas backend) is mocked: the tests do not mount the Canvas providers.
const active = vi.hoisted(() => ({ projectId: "autoriz" as string }));
vi.mock("#/factory/project-context", async (orig) => {
  const real = await orig<typeof import("#/factory/project-context")>();
  return {
    ...real,
    useSelectedProject: () => {
      const project = active.projectId
        ? PROJECTS.find((p) => p.id === active.projectId)
        : undefined;
      return {
        projectId: project ? project.id : "",
        project,
        projects: PROJECTS,
        setProjectId: vi.fn(),
      };
    },
  };
});

// The open conversation (its tags say whether it writes a workflow).
const conversation = vi.hoisted(() => ({
  tags: null as Record<string, string> | null,
}));
vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({ data: { tags: conversation.tags } }),
}));

const def: WorkflowDefinition = {
  schema: 1,
  name: "Léger",
  description: "",
  nodes: [
    {
      id: "start",
      type: "trigger",
      config: {
        trigger: { kind: "label", label: "factory:ready" },
        filters: { mode: "all", conditions: [] },
      },
    },
    {
      id: "review",
      type: "human",
      config: {
        title: "Plan",
        what: "le plan",
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
            label: "Changer",
            kind: "changes",
            requireComment: true,
          },
        ],
        quorum: 1,
        postFilesToIssue: true,
      },
    },
    { id: "done", type: "end", config: { result: "completed" } },
  ],
  edges: [
    { from: "start", port: "out", to: "review" },
    { from: "review", port: "approve", to: "done" },
  ],
  settings: {
    onExisting: "ignore",
    cancelOnLabelRemoved: true,
    cancelOnIssueClosed: true,
    speckit: false,
  },
  layout: {},
};

/** The session as the orchestrator returns it (owner's hand edits included). */
const sessionView = {
  definition: def,
  ok: true,
  problems: [],
  ports: {},
  ownerNodes: ["start"],
  ownerWorkflow: false,
  restored: { nodes: ["start"], workflow: false, at: "2026-11-23T10:00:00Z" },
};

describe("workflow graph helpers", () => {
  it("lays out every node and keeps saved positions", () => {
    const l = autoLayout({ ...def, layout: { start: { x: 5, y: 7 } } });
    expect(Object.keys(l).sort()).toEqual(["done", "review", "start"]);
    expect(l.start).toEqual({ x: 5, y: 7 });
    expect(l.review!.x).toBeGreaterThan(l.start!.x);
  });

  it("draws server ports, problems and run counts", () => {
    const f = toFlow(def, {
      ports: { review: { ports: ["approve", "changes"], optional: [] } },
      problems: [{ node: "review", message: "sortie « changes » non reliée" }],
      runsByNode: new Map([["review", 2]]),
      readOnly: false,
    });
    const review = f.nodes.find((n) => n.id === "review")!;
    expect(review.data.ports).toEqual(["approve", "changes"]);
    expect(review.data.problems).toEqual(["sortie « changes » non reliée"]);
    expect(review.data.runs).toBe(2);
    expect(f.edges.map((e) => e.id)).toEqual(["start::out", "review::approve"]);
  });

  it("renames a node in edges and layout", () => {
    const d = renameNode(
      { ...def, layout: { review: { x: 1, y: 2 } } },
      "review",
      "plan_review",
    );
    expect(d.nodes.map((n) => n.id)).toContain("plan_review");
    expect(d.edges).toContainEqual({
      from: "start",
      port: "out",
      to: "plan_review",
    });
    expect(d.layout.plan_review).toEqual({ x: 1, y: 2 });
  });

  it("creates unique node ids and a minimal workflow", () => {
    const b = blankDefinition("x");
    expect(newNode(b, "agent").id).toBe("agent_1");
    expect(b.edges).toEqual([{ from: "start", port: "out", to: "done" }]);
  });
});

describe("edge routing", () => {
  const box = (id: string, x: number, y: number) => ({
    id,
    x,
    y,
    w: 100,
    h: 60,
  });
  const crosses = (
    pts: { x: number; y: number }[],
    b: { x: number; y: number; w: number; h: number },
  ) =>
    pts.slice(1).some((p, i) => {
      const a = pts[i]!;
      return (
        Math.max(a.x, p.x) > b.x &&
        Math.min(a.x, p.x) < b.x + b.w &&
        Math.max(a.y, p.y) > b.y &&
        Math.min(a.y, p.y) < b.y + b.h
      );
    });

  it("goes straight when nothing is in the way", () => {
    expect(routeEdge({ x: 100, y: 30 }, { x: 300, y: 30 }, [])).toEqual([
      { x: 100, y: 30 },
      { x: 300, y: 30 },
    ]);
  });

  it("goes around a node sitting on the straight line", () => {
    const blocker = box("mid", 180, 0);
    const pts = routeEdge({ x: 100, y: 30 }, { x: 400, y: 30 }, [blocker]);
    expect(crosses(pts, blocker)).toBe(false);
  });

  it("routes loops below the nodes, in separate lanes", () => {
    const src = box("src", 300, 0);
    const tgt = box("tgt", 0, 0);
    const a = routeEdge({ x: 400, y: 30 }, { x: 0, y: 30 }, [], 0, {
      source: src,
      target: tgt,
    });
    const b = routeEdge({ x: 400, y: 30 }, { x: 0, y: 30 }, [], 1, {
      source: src,
      target: tgt,
    });
    expect(Math.max(...a.map((p) => p.y))).toBeGreaterThan(60);
    expect(Math.max(...b.map((p) => p.y))).toBeGreaterThan(
      Math.max(...a.map((p) => p.y)),
    );
    expect(crosses(a, src) || crosses(a, tgt)).toBe(false);
  });

  it("builds a rounded path with the label on a horizontal segment", () => {
    const { d, label } = roundedPath([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
      { x: 200, y: 100 },
    ]);
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d).toContain("Q 50 0");
    expect(label).toEqual({ x: 125, y: 100 });
  });

  it("toFlow gives every link a routed edge with obstacles and lanes", () => {
    const f = toFlow(def, { readOnly: false });
    expect(f.edges.every((e) => e.type === "routed")).toBe(true);
    expect(f.edges[0]!.data!.obstacles.map((b) => b.id)).toEqual(["done"]);
  });
});

const PROJECTS: FactoryProject[] = [
  {
    id: "autoriz",
    name: "Autoriz",
    repo: "o/r",
    status: "ok",
    error: null,
    active: true,
    subscription: null,
    paused: null,
    backend: { id: "factory-autoriz", path: "/agents/autoriz" },
    defaultWorkflow: "light",
    enabledWorkflows: ["light", "weekly"],
    commands: ["test"],
  },
];

const summary = (
  over: Partial<WorkflowSummary> & { id: string },
): WorkflowSummary => ({
  scope: "autoriz",
  name: over.id,
  description: "",
  builtin: false,
  archived: false,
  latestVersion: 1,
  updatedAt: "",
  customised: false,
  source: null,
  templateUpdate: null,
  ...over,
});

const TEMPLATES = [
  summary({
    id: "light",
    name: "Léger",
    scope: "template",
    builtin: true,
    customised: true,
  }),
  summary({ id: "speckit", name: "SpecKit", scope: "template", builtin: true }),
];
const PROJECT_WORKFLOWS = [
  summary({
    id: "light",
    name: "Léger",
    source: "light@1",
    templateUpdate: { templateId: "light", from: 1, to: 2 },
  }),
  summary({ id: "mine", name: "Le mien", latestVersion: 3 }),
  summary({
    id: "weekly",
    name: "Revue hebdomadaire",
    scheduled: true,
    triggers: [
      { kind: "schedule", cron: "0 8 * * 1", timezone: "Europe/Paris" },
    ],
    nextRunAt: "2030-01-07T07:00:00.000Z",
    activity: {
      runs: 2,
      completed: 1,
      failed: 1,
      avgSeconds: 600,
      last: {
        id: 4,
        state: "FAILED",
        at: "2029-12-31T07:00:00.000Z",
        seconds: 120,
      },
    },
  }),
];

describe("Workflows pages", () => {
  const calls: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
  }[] = [];
  beforeEach(() => {
    active.projectId = "autoriz";
    calls.length = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
        const url = String(input);
        const path = url.split("?")[0]!;
        const method = init.method ?? "GET";
        calls.push({
          url,
          method,
          headers: (init.headers ?? {}) as Record<string, string>,
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        const json = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), { status });
        if (path.endsWith("/validate"))
          return json({
            ok: true,
            problems: [],
            ports: {
              start: { ports: ["out"], optional: [] },
              review: { ports: ["approve", "changes"], optional: [] },
              done: { ports: [], optional: [] },
            },
          });
        if (path === "/factory-api/projects")
          return json({ projects: PROJECTS });
        if (path === "/factory-api/templates")
          return json({ workflows: TEMPLATES });
        if (path === "/factory-api/projects/autoriz/workflows") {
          if (method === "POST")
            return json({
              id: (JSON.parse(String(init.body)) as { id: string }).id,
              version: 1,
            });
          return json({ workflows: PROJECT_WORKFLOWS });
        }
        const detail = path.match(
          /^\/factory-api\/(templates|projects\/autoriz\/workflows)\/([\w-]+)(\/\w+)?$/,
        );
        if (detail) {
          const [, base, id, action] = detail;
          if (id === "broken") return json({ error: "boom" }, 500);
          if (action === "/reset") return json({ version: 3 });
          if (action === "/run") return json({ runId: 9 });
          if (method === "PUT") return json({ version: 4 });
          const list = base === "templates" ? TEMPLATES : PROJECT_WORKFLOWS;
          const workflow = list.find((w) => w.id === id);
          if (!workflow) return json({ error: "workflow inconnu" }, 404);
          return json({
            workflow,
            versions: [
              {
                version: workflow.latestVersion,
                createdBy: "factory",
                comment: "",
                createdAt: "",
              },
            ],
            definition: def,
          });
        }
        if (path === "/factory-api/projects/autoriz/workflow-sessions")
          return json({ session: "abcdefabcdef", conversationId: "conv-9" });
        if (
          path ===
          "/factory-api/projects/autoriz/workflow-sessions/abcdefabcdef/save"
        )
          return json({ scope: "autoriz", id: "friday", version: 1 });
        if (
          path.startsWith(
            "/factory-api/projects/autoriz/workflow-sessions/abcdefabcdef/",
          )
        )
          return json({
            ...sessionView,
            ownerNodes: method === "DELETE" ? [] : ["start"],
          });
        if (
          path ===
          "/factory-api/projects/autoriz/workflow-sessions/abcdefabcdef"
        )
          return json({
            session: "abcdefabcdef",
            scope: "autoriz",
            workflowId: null,
            baseVersion: null,
            createdBy: "dev",
            createdAt: "",
            ...sessionView,
          });
        if (path.endsWith("/node-types"))
          return json({
            catalog: [
              {
                type: "agent",
                label: "Agent",
                family: "Agent",
                description: "",
              },
              {
                type: "review",
                label: "Revue critique",
                family: "Contrôle",
                description: "",
              },
            ],
            templateVars: [],
            conditionFields: [],
          });
        if (path.endsWith("/runs")) return json({ runs: [] });
        return json({ error: "not found" }, 404);
      }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  const renderPage = (entry = "/factory/workflows") => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/factory/workflows" element={<WorkflowListPage />} />
            <Route
              path="/factory/workflows/:workflowId"
              element={<WorkflowDetailPage />}
            />
            <Route
              path="/factory/workflows/:workflowId/edit"
              element={<WorkflowEditPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return client;
  };

  it("lists the project's workflows as cards, with trigger, activity and next run", async () => {
    renderPage();
    expect(await screen.findByTestId("wf-card-mine")).toBeInTheDocument();
    expect(screen.getByTestId("wf-tab-project")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const weekly = screen.getByTestId("wf-card-weekly");
    expect(weekly).toHaveTextContent("Europe/Paris");
    expect(weekly).toHaveTextContent("2 runs in 30 d · 50% succeeded");
    expect(weekly).toHaveTextContent(/Next:/);
    expect(screen.getByTestId("wf-card-mine")).toHaveTextContent("Disabled");
    expect(screen.queryByTestId("wf-run-now-mine")).not.toBeInTheDocument();
    // The templates to start from, below the project's own workflows.
    expect(
      await screen.findByTestId("wf-template-card-speckit"),
    ).toBeInTheDocument();
  });

  it("runs a scheduled workflow now from its card", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByTestId("wf-run-now-weekly"));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.url === "/factory-api/projects/autoriz/workflows/weekly/run",
        ),
      ).toBe(true),
    );
  });

  it("switches to the template library", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("wf-card-mine");
    await user.click(screen.getByTestId("wf-tab-template"));
    expect(await screen.findByTestId("wf-card-speckit")).toBeInTheDocument();
    expect(screen.queryByTestId("wf-card-mine")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("wf-create-from-template"),
    ).not.toBeInTheDocument();
  });

  it("shows only templates without an active project", async () => {
    active.projectId = "";
    renderPage();
    expect(await screen.findByTestId("wf-card-light")).toBeInTheDocument();
    expect(screen.queryByTestId("wf-tab-project")).not.toBeInTheDocument();
    expect(
      calls.some((c) => c.url.includes("/projects/autoriz/workflows")),
    ).toBe(false);
  });

  it("a workflow's page: trigger, steps, settings, and the editor one click away", async () => {
    const user = userEvent.setup();
    renderPage("/factory/workflows/weekly");
    const trigger = await screen.findByTestId("wf-detail-trigger");
    expect(trigger).toHaveTextContent("Europe/Paris");
    expect(trigger).toHaveTextContent("Next run");
    expect(screen.getByTestId("wf-detail-enabled")).toHaveTextContent(
      "Enabled",
    );
    expect(screen.getByTestId("wf-detail-steps")).toBeInTheDocument();
    expect(screen.getByTestId("wf-detail-run-now")).toBeInTheDocument();
    await user.click(screen.getByTestId("wf-detail-edit"));
    expect(await screen.findByTestId("wf-node-review")).toBeInTheDocument();
  });

  it("old deep links open the editor on the node; it validates in the project scope", async () => {
    renderPage("/factory/workflows?wf=light&node=review");
    expect(await screen.findByTestId("wf-node-id")).toHaveValue("review");
    expect(screen.getByTestId("wf-scope")).toHaveTextContent(
      "Autoriz workflows",
    );
    expect(screen.getByTestId("wf-source")).toHaveTextContent("from light");
    expect(screen.getByTestId("wf-save")).toBeDisabled(); // nothing changed yet
    await waitFor(() =>
      expect(screen.getByTestId("wf-validity")).toHaveTextContent(/^valid$/),
    );
    const v = calls.find((c) => c.url.endsWith("/validate"))!;
    expect(v.url).toBe("/factory-api/projects/autoriz/workflows/validate");
    expect(v.headers["X-Factory-Request"]).toBe("1");
  });

  it("keeps unsaved edits and the selection when the same version is refetched", async () => {
    const user = userEvent.setup();
    const client = renderPage("/factory/workflows/mine/edit?node=review");
    expect(await screen.findByTestId("wf-node-id")).toHaveValue("review");
    const label = screen
      .getByTestId("wf-inspector")
      .querySelectorAll("input")[1]!;
    await user.type(label, "Relecture");
    await client.invalidateQueries();
    await waitFor(() =>
      expect(
        calls.filter((c) => c.url.endsWith("/projects/autoriz/workflows/mine"))
          .length,
      ).toBeGreaterThan(1),
    );
    expect(screen.getByTestId("wf-node-id")).toHaveValue("review");
    expect(
      screen.getByTestId("wf-inspector").querySelectorAll("input")[1],
    ).toHaveValue("Relecture");
  });

  it("edits a project workflow and saves a new version with the header", async () => {
    const user = userEvent.setup();
    renderPage("/factory/workflows/mine/edit");
    await screen.findByTestId("wf-node-review");
    await user.click(await screen.findByTestId("wf-add-agent"));
    expect(await screen.findByTestId("wf-node-agent_1")).toBeInTheDocument();
    await user.click(screen.getByTestId("wf-save"));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PUT")).toBe(true),
    );
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.url).toBe("/factory-api/projects/autoriz/workflows/mine");
    expect(put.headers["X-Factory-Request"]).toBe("1");
    expect(
      (put.body as { definition: WorkflowDefinition }).definition.nodes.map(
        (n) => n.id,
      ),
    ).toContain("agent_1");
  });

  async function savedNodes() {
    await userEvent.setup().click(screen.getByTestId("wf-save"));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PUT")).toBe(true),
    );
    return (
      calls.find((c) => c.method === "PUT")!.body as {
        definition: WorkflowDefinition;
      }
    ).definition.nodes;
  }

  it("an agent node's end-of-turn checks (Stop hook) are project command names", async () => {
    const user = userEvent.setup();
    renderPage("/factory/workflows/mine/edit");
    await screen.findByTestId("wf-node-review");
    await user.click(await screen.findByTestId("wf-add-agent"));
    await user.type(
      await screen.findByTestId("wf-agent-stop-checks"),
      "lint, typecheck",
    );
    const nodes = await savedNodes();
    expect(nodes.find((n) => n.id === "agent_1")!.config.stopChecks).toEqual([
      "lint",
      "typecheck",
    ]);
  });

  it("sets an agent step's reasoning effort", async () => {
    const user = userEvent.setup();
    renderPage("/factory/workflows/mine/edit");
    await screen.findByTestId("wf-node-review");
    await user.click(await screen.findByTestId("wf-add-agent"));
    const effort = await screen.findByTestId("wf-effort");
    expect(effort).toHaveValue("default");
    await user.selectOptions(effort, "high");
    const nodes = await savedNodes();
    expect(nodes.find((n) => n.id === "agent_1")!.config.effort).toBe("high");
  });

  it("an effort back to default is not stored", async () => {
    const user = userEvent.setup();
    renderPage("/factory/workflows/mine/edit");
    await screen.findByTestId("wf-node-review");
    await user.click(await screen.findByTestId("wf-add-agent"));
    await user.selectOptions(await screen.findByTestId("wf-effort"), "max");
    await user.selectOptions(screen.getByTestId("wf-effort"), "default");
    const nodes = await savedNodes();
    expect(nodes.find((n) => n.id === "agent_1")!.config).not.toHaveProperty(
      "effort",
    );
  });

  it("adds a critical review node and picks its focus", async () => {
    const user = userEvent.setup();
    renderPage("/factory/workflows/mine/edit");
    await screen.findByTestId("wf-node-review");
    await user.click(await screen.findByTestId("wf-add-review"));
    const focus = await screen.findByTestId("wf-review-focus");
    await user.click(within(focus).getByText("Tests"));
    const nodes = await savedNodes();
    expect(nodes.find((n) => n.id === "review_1")!.config).toEqual({
      focus: ["correctness", "security", "tests"],
      blockOn: "important",
    });
  });

  it("creates a project workflow from a template card", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByTestId("wf-template-card-speckit"));
    const dialog = await screen.findByTestId("wf-dialog");
    expect(within(dialog).getByTestId("wf-dialog-id")).toHaveValue("speckit");
    await user.clear(within(dialog).getByTestId("wf-dialog-id"));
    await user.type(within(dialog).getByTestId("wf-dialog-id"), "my-speckit");
    await user.click(within(dialog).getByTestId("wf-dialog-submit"));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.url === "/factory-api/projects/autoriz/workflows",
        ),
      ).toBe(true),
    );
    const post = calls.find(
      (c) =>
        c.method === "POST" &&
        c.url === "/factory-api/projects/autoriz/workflows",
    )!;
    expect(post.body).toEqual({ fromTemplate: "speckit", id: "my-speckit" });
  });

  it("refuses an id the project already uses", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("wf-card-mine");
    await user.click(screen.getByTestId("wf-new"));
    const dialog = await screen.findByTestId("wf-dialog");
    await waitFor(() =>
      expect(calls.some((c) => c.url.endsWith("/workflows?archived=1"))).toBe(
        true,
      ),
    );
    await user.type(within(dialog).getByTestId("wf-dialog-id"), "mine");
    await waitFor(() =>
      expect(within(dialog).getByTestId("wf-dialog-submit")).toBeDisabled(),
    );
  });

  it("offers the template update behind a confirmation", async () => {
    const user = userEvent.setup();
    renderPage("/factory/workflows/light/edit");
    const notice = await screen.findByTestId("wf-template-update");
    expect(notice).toHaveTextContent("New version of template light (v1 → v2)");
    await user.click(within(notice).getByTestId("wf-apply-template-update"));
    expect(calls.some((c) => c.url.endsWith("/reset"))).toBe(false);
    await user.click(await screen.findByTestId("confirm-button"));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.url === "/factory-api/projects/autoriz/workflows/light/reset",
        ),
      ).toBe(true),
    );
  });

  it("creates a workflow with the agent: a conversation starts on the project's backend", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByTestId("wf-create-with-agent"));
    const dialog = await screen.findByTestId("wf-agent-dialog");
    expect(within(dialog).getByTestId("wf-agent-start")).toBeDisabled();
    await user.type(
      within(dialog).getByTestId("wf-agent-prompt"),
      "chaque vendredi, une revue",
    );
    await user.click(within(dialog).getByTestId("wf-agent-start"));
    await waitFor(() =>
      expect(
        calls.find(
          (c) => c.url === "/factory-api/projects/autoriz/workflow-sessions",
        )?.body,
      ).toEqual({ scope: "autoriz", prompt: "chaque vendredi, une revue" }),
    );
  });

  it("the Workflow tab shows the agent's draft and the owner saves it as a new workflow", async () => {
    conversation.tags = {
      factoryproject: "autoriz",
      factoryworkflowsession: "abcdefabcdef",
    };
    try {
      const user = userEvent.setup();
      const { default: WorkflowSessionTab } =
        await import("#/factory/workflows/workflow-session-tab");
      render(
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <MemoryRouter>
            <WorkflowSessionTab />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      expect(
        await screen.findByTestId("wf-session-validity"),
      ).toHaveTextContent("valid");
      expect(
        screen.getByTestId("factory-workflow-preview"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("wf-session-save")).toBeDisabled(); // an id first
      await user.type(screen.getByTestId("wf-session-id"), "friday");
      await user.click(screen.getByTestId("wf-session-save"));
      await waitFor(() =>
        expect(
          calls.find((c) =>
            c.url.endsWith("/workflow-sessions/abcdefabcdef/save"),
          )?.body,
        ).toEqual({ id: "friday" }),
      );
    } finally {
      conversation.tags = null;
    }
  });

  it("the Workflow tab: the owner edits a node and the settings by hand, and hands a node back", async () => {
    conversation.tags = {
      factoryproject: "autoriz",
      factoryworkflowsession: "abcdefabcdef",
    };
    try {
      const user = userEvent.setup();
      const { default: WorkflowSessionTab } =
        await import("#/factory/workflows/workflow-session-tab");
      render(
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <MemoryRouter>
            <WorkflowSessionTab />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      // An agent change to the owner's node was reverted.
      expect(
        await screen.findByTestId("wf-session-restored"),
      ).toHaveTextContent("start");
      // The owner's nodes are listed; one opens its form.
      const owned = screen.getByTestId("wf-session-owned");
      await user.click(within(owned).getByRole("button", { name: "start" }));
      const panel = await screen.findByTestId("wf-session-node-panel");
      expect(within(panel).getByTestId("wf-node-id")).toBeDisabled();
      expect(
        within(panel).queryByTestId("wf-delete-node"),
      ).not.toBeInTheDocument();
      expect(
        within(panel).getByTestId("wf-session-owned-pill"),
      ).toBeInTheDocument();
      // The node's own label (the trigger form has a label field too).
      await user.type(within(panel).getAllByLabelText("Label")[0]!, "Go");
      // Sent once the owner pauses, as the whole node.
      await waitFor(
        () =>
          expect(
            calls
              .filter(
                (c) =>
                  c.method === "PUT" &&
                  c.url.endsWith("/workflow-sessions/abcdefabcdef/nodes/start"),
              )
              .at(-1)?.body,
          ).toMatchObject({ node: { id: "start", label: "Go" } }),
        { timeout: 3000 },
      );
      await user.click(within(panel).getByTestId("wf-session-release"));
      await waitFor(() =>
        expect(
          calls.some(
            (c) =>
              c.method === "DELETE" &&
              c.url.endsWith("/workflow-sessions/abcdefabcdef/owner/start"),
          ),
        ).toBe(true),
      );
      // Name and settings.
      await user.click(screen.getByTestId("wf-session-settings"));
      const settings = await screen.findByTestId("wf-session-settings-panel");
      await user.clear(within(settings).getByTestId("wf-name"));
      await user.type(within(settings).getByTestId("wf-name"), "Vendredi");
      await waitFor(
        () =>
          expect(
            calls
              .filter(
                (c) =>
                  c.method === "PUT" &&
                  c.url.endsWith("/workflow-sessions/abcdefabcdef/workflow"),
              )
              .at(-1)?.body,
          ).toMatchObject({ name: "Vendredi", description: "" }),
        { timeout: 3000 },
      );
    } finally {
      conversation.tags = null;
    }
  });

  it("shows the error when the workflow fails to load", async () => {
    renderPage("/factory/workflows/broken/edit");
    expect(
      await screen.findByText(/Could not load workflow broken: boom/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("wf-editor")).not.toBeInTheDocument();
  });
});

describe("factory conversation UI", () => {
  it("parses spec-kit phases and shows the current one in the banner", async () => {
    const { parsePhases } = await import("#/factory/speckit-phase");
    const { SpeckitPhases } = await import("#/factory/conversation-banner");
    const log = [
      { phase: "specify", status: "started", at: 1 },
      { phase: "specify", status: "done", at: 2 },
      { phase: "plan", status: "started", at: 3 },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n");
    const progress = parsePhases(`${log}\n{"phase":"pla`)!;
    expect(progress).toEqual({
      current: { phase: "plan", status: "started", at: 3 },
      phases: { specify: "done", plan: "started" },
    });
    expect(parsePhases("")).toBeNull();
    render(<SpeckitPhases progress={progress} />);
    expect(screen.getByTestId("factory-banner-phase")).toHaveTextContent(
      "/speckit.planin progress",
    );
  });

  it("banner shows workflow, state, steps and a decide action", async () => {
    const { FactoryBannerView } = await import("#/factory/conversation-banner");
    const onDecide = vi.fn();
    render(
      <MemoryRouter>
        <FactoryBannerView
          onDecide={onDecide}
          ticket={{
            version: 1,
            issue: 552,
            title: "Étude",
            state: "HUMAN",
            stateLabel: "Validation de la spec",
            steps: [
              { key: "spec", label: "Spécification", status: "done" },
              { key: "spec_review", label: "Validation", status: "review" },
            ],
            workflow: {
              id: "speckit-full",
              version: 2,
              name: "SpecKit complet",
            },
            node: "spec_review",
            review: { what: "la spécification", files: [] },
            updatedAt: "2026-11-22T10:00:00Z",
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("factory-banner-workflow")).toHaveTextContent(
      "SpecKit complet · v2",
    );
    expect(screen.getByTestId("factory-banner-state")).toHaveTextContent(
      "to review",
    );
    expect(screen.getByTestId("factory-banner-edit")).toHaveAttribute(
      "href",
      "/factory/workflows/speckit-full/edit?node=spec_review",
    );
    await userEvent.click(screen.getByTestId("factory-banner-decide"));
    expect(onDecide).toHaveBeenCalledOnce();
    // Mobile: details collapsed behind a toggle, Decide stays reachable.
    const expand = screen.getByTestId("factory-banner-expand");
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByTestId("factory-banner-steps").parentElement,
    ).toHaveClass("hidden");
    await userEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByTestId("factory-banner-steps").parentElement,
    ).not.toHaveClass("hidden");
    await userEvent.click(screen.getByTestId("factory-banner-decide-compact"));
    expect(onDecide).toHaveBeenCalledTimes(2);
  });

  it("banner can be closed to a thin line and reopened", async () => {
    const { FactoryBannerView } = await import("#/factory/conversation-banner");
    const onDecide = vi.fn();
    const ticket = {
      version: 1,
      issue: 792,
      title: "Activité",
      state: "HUMAN",
      stateLabel: "Test manuel",
      steps: [{ key: "manual_test", label: "Test manuel", status: "review" }],
      workflow: { id: "speckit-full", version: 2, name: "SpecKit complet" },
      node: "manual_test",
      review: { what: "le test manuel", files: [] },
      updatedAt: "2026-11-27T10:00:00Z",
    } as const;
    function Host() {
      const [closed, setClosed] = React.useState(false);
      return (
        <FactoryBannerView
          ticket={ticket as never}
          onDecide={onDecide}
          closed={closed}
          onClose={() => setClosed(true)}
          onOpen={() => setClosed(false)}
        />
      );
    }
    render(
      <MemoryRouter>
        <Host />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getAllByTestId("factory-banner-close")[0]);
    expect(screen.queryByTestId("factory-banner")).not.toBeInTheDocument();
    expect(screen.getByTestId("factory-banner-closed")).toHaveTextContent(
      "#792",
    );
    await userEvent.click(screen.getByTestId("factory-banner-closed-decide"));
    expect(onDecide).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByTestId("factory-banner-open"));
    expect(screen.getByTestId("factory-banner")).toBeInTheDocument();
  });
});
