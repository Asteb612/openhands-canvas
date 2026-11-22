import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowDefinition } from "#/factory/workflows/api";
import { autoLayout, renameNode, toFlow } from "#/factory/workflows/graph";
import { blankDefinition, newNode } from "#/factory/workflows/defaults";
import { MemoryRouter } from "react-router";
import WorkflowsPage from "#/factory/workflows/workflows-page";

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

describe("WorkflowsPage", () => {
  const calls: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
  }[] = [];
  beforeEach(() => {
    calls.length = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
        const url = String(input);
        const method = init.method ?? "GET";
        calls.push({
          url,
          method,
          headers: (init.headers ?? {}) as Record<string, string>,
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        const json = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), { status });
        if (url.endsWith("/factory-api/workflows")) {
          return json({
            workflows: [
              {
                id: "light",
                name: "Léger",
                description: "",
                builtin: true,
                archived: false,
                latestVersion: 1,
                updatedAt: "",
              },
              {
                id: "mine",
                name: "Le mien",
                description: "",
                builtin: false,
                archived: false,
                latestVersion: 3,
                updatedAt: "",
              },
            ],
          });
        }
        if (
          url.includes("/factory-api/workflows/light") ||
          url.includes("/factory-api/workflows/mine")
        ) {
          const id = url.includes("mine") ? "mine" : "light";
          if (method === "PUT") return json({ version: 4 });
          return json({
            workflow: {
              id,
              name: def.name,
              description: "",
              builtin: id === "light",
              archived: false,
              latestVersion: id === "mine" ? 3 : 1,
              updatedAt: "",
            },
            versions: [
              { version: 1, createdBy: "factory", comment: "", createdAt: "" },
            ],
            definition: def,
          });
        }
        if (url.endsWith("/workflows/validate")) {
          return json({
            ok: true,
            problems: [],
            ports: {
              start: { ports: ["out"], optional: [] },
              review: { ports: ["approve", "changes"], optional: [] },
              done: { ports: [], optional: [] },
            },
          });
        }
        if (url.endsWith("/node-types")) {
          return json({
            catalog: [
              {
                type: "agent",
                label: "Agent",
                family: "Agent",
                description: "",
              },
            ],
            templateVars: [],
            conditionFields: [],
          });
        }
        if (url.endsWith("/projects"))
          return json({
            projects: [
              {
                id: "autoriz",
                repo: "o/r",
                active: true,
                defaultWorkflow: "light",
                enabledWorkflows: ["light"],
                commands: ["test"],
              },
            ],
          });
        if (url.includes("/runs")) return json({ runs: [] });
        return json({ error: "not found" }, 404);
      }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  const renderPage = () =>
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <WorkflowsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it("opens a built-in editable and validates it server-side", async () => {
    renderPage();
    expect(await screen.findByTestId("wf-node-review")).toBeInTheDocument();
    expect(screen.getByTestId("wf-builtin")).toHaveTextContent(
      "modèle intégré",
    );
    expect(screen.getByTestId("wf-save")).toBeDisabled(); // nothing changed yet
    await waitFor(() =>
      expect(screen.getByTestId("wf-validity")).toHaveTextContent("valide"),
    );
    const v = calls.find((c) => c.url.endsWith("/validate"))!;
    expect(v.headers["X-Factory-Request"]).toBe("1");
  });

  it("keeps unsaved edits and the selection when the same version is refetched", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/workflows?wf=mine&node=review"]}>
          <WorkflowsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("wf-node-id")).toHaveValue("review");
    const label = screen
      .getByTestId("wf-inspector")
      .querySelectorAll("input")[1]!;
    await user.type(label, "Relecture");
    await client.invalidateQueries();
    await waitFor(() =>
      expect(
        calls.filter((c) => c.url.endsWith("/workflows/mine")).length,
      ).toBeGreaterThan(1),
    );
    expect(screen.getByTestId("wf-node-id")).toHaveValue("review");
    expect(
      screen.getByTestId("wf-inspector").querySelectorAll("input")[1],
    ).toHaveValue("Relecture");
  });

  it("edits a workflow and saves a new version with the header", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByTestId("wf-list-mine"));
    await screen.findByTestId("wf-node-review");
    await user.click(await screen.findByTestId("wf-add-agent"));
    expect(await screen.findByTestId("wf-node-agent_1")).toBeInTheDocument();
    await user.click(screen.getByTestId("wf-save"));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PUT")).toBe(true),
    );
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.url).toBe("/factory-api/workflows/mine");
    expect(put.headers["X-Factory-Request"]).toBe("1");
    expect(
      (put.body as { definition: WorkflowDefinition }).definition.nodes.map(
        (n) => n.id,
      ),
    ).toContain("agent_1");
  });
});

describe("factory conversation UI", () => {
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
      "à valider",
    );
    expect(screen.getByTestId("factory-banner-edit")).toHaveAttribute(
      "href",
      "/workflows?wf=speckit-full&node=spec_review",
    );
    await userEvent.click(screen.getByTestId("factory-banner-decide"));
    expect(onDecide).toHaveBeenCalledOnce();
  });
});
