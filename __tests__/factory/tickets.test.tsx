import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TicketsPage, { since } from "#/factory/tickets/tickets-page";
import {
  columnMatches,
  groupRuns,
  isHistoryColumn,
} from "#/factory/tickets/columns";
import { formatDuration } from "#/factory/format";
import { diffAlerts } from "#/factory/notifier";
import FactoryProjectPage, { slugify } from "#/factory/project-page";
import { useFactoryProjectStore } from "#/factory/project-context";
import { toFlow } from "#/factory/workflows/graph";
import {
  FactoryTaskTypePicker,
  splitTask,
  type FactoryTaskOptions,
} from "#/factory/task-type";
import type { FactoryRun } from "#/factory/workflows/api";

const run = (over: Partial<FactoryRun>): FactoryRun => ({
  id: 1,
  project: "autoriz",
  issue: 1,
  title: "Titre",
  state: "ACTIVE",
  workflow: "bugfix",
  version: 1,
  node: "fix",
  prNumber: null,
  conversationId: "c1",
  updatedAt: "2026-11-22T10:00:00Z",
  workflowName: "Bugfix",
  nodeLabel: "Correctif",
  repo: "o/r",
  nodeEnteredAt: "2026-11-22T10:00:00Z",
  ...over,
});

const RUNS: FactoryRun[] = [
  run({
    id: 1,
    issue: 9001,
    state: "HUMAN",
    title: "Export PDF",
    nodeLabel: "Revue de la spec",
  }),
  run({ id: 2, issue: 9002, state: "ACTIVE", title: "Surface vide" }),
  run({
    id: 3,
    issue: 9003,
    state: "QUEUED",
    conversationId: null,
    title: "Filtre commune",
  }),
  run({
    id: 4,
    issue: 9005,
    state: "FAILED",
    title: "Historique",
    failureMessage: "maxVisits atteint",
  }),
  run({
    id: 5,
    issue: 9004,
    state: "COMPLETED",
    title: "PostGIS",
    workflow: "spike",
    workflowName: "Spike",
  }),
];

describe("tickets helpers", () => {
  it("groups runs by column with filters", () => {
    const g = groupRuns(RUNS, {}).groups;
    expect(
      Object.fromEntries(
        Object.entries(g).map(([k, v]) => [k, v.map((r) => r.issue)]),
      ),
    ).toEqual({
      human: [9001],
      active: [9002],
      queued: [9003],
      failed: [9005],
      done: [9004],
    });
    expect(groupRuns(RUNS, { text: "revue" }).groups.human).toHaveLength(1);
    expect(groupRuns(RUNS, { text: "revue" }).groups.active).toHaveLength(0);
    expect(groupRuns(RUNS, { workflow: "spike" }).groups.done).toHaveLength(1);
    expect(groupRuns(RUNS, { project: "other" }).groups.human).toHaveLength(0);
  });

  it("custom columns: first match wins, by state and step; leftovers go to Autres", () => {
    const columns = [
      { id: "fix", title: "Correctif", nodes: ["bugfix/fix"] },
      { id: "review", title: "Revue", states: ["HUMAN"], nodes: ["*/fix"] },
      { id: "end", title: "Fini", states: ["COMPLETED", "CANCELLED"] },
    ];
    const { columns: cols, groups } = groupRuns(RUNS, {}, columns.slice(0, 2));
    expect(cols.map((c) => c.id)).toEqual(["fix", "review", "__other"]);
    // Every example run sits on node "fix" of "bugfix" except the spike one.
    expect(groups.fix!.map((r) => r.issue)).toEqual([9001, 9002, 9003, 9005]);
    expect(groups.review).toEqual([]);
    expect(
      groupRuns(RUNS, {}, columns).groups.end!.map((r) => r.issue),
    ).toEqual([9004]);
    expect(groups.__other!.map((r) => r.issue)).toEqual([9004]);
    expect(isHistoryColumn(columns[2]!)).toBe(true);
    expect(
      columnMatches({ id: "t", title: "t", nodeTypes: ["human"] }, RUNS[0]!),
    ).toBe(false);
  });

  it("formats durations and column ids", () => {
    expect(formatDuration(42)).toBe("42 s");
    expect(formatDuration(720)).toBe("12 min");
    expect(formatDuration(3 * 3600 + 20 * 60)).toBe("3 h 20");
    expect(formatDuration(52 * 3600)).toBe("2 j 4 h");
    expect(formatDuration(null)).toBe("—");
    expect(slugify("Revue de spéc", ["revue-de-spec"])).toBe("revue-de-spec-2");
  });

  it("alerts only on runs that newly need the owner", () => {
    expect(diffAlerts(null, RUNS)).toEqual([]);
    const before = new Map(RUNS.map((r) => [r.id, r.state]));
    before.set(1, "ACTIVE");
    before.set(4, "ACTIVE");
    const alerts = diffAlerts(before, RUNS);
    expect(alerts.map((a) => a.title)).toEqual([
      "🏭 #9001 à valider",
      "🏭 #9005 en échec",
    ]);
    expect(alerts[0]!.conversationId).toBe("c1");
    expect(diffAlerts(new Map(RUNS.map((r) => [r.id, r.state])), RUNS)).toEqual(
      [],
    );
  });

  it("formats durations in French", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    expect(since("2026-11-22T11:59:30Z", now)).toBe("à l'instant");
    expect(since("2026-11-22T11:45:00Z", now)).toBe("15 min");
    expect(since("2026-11-22T09:00:00Z", now)).toBe("3 h");
    expect(since("2026-11-18T12:00:00Z", now)).toBe("4 j");
  });

  it("splits a typed task into an issue title and body", () => {
    expect(splitTask("  Corriger le PDF\n\nIl plante  ")).toEqual({
      title: "Corriger le PDF",
      body: "Corriger le PDF\n\nIl plante",
    });
    expect(splitTask("x".repeat(200)).title).toHaveLength(118);
  });
});

describe("tickets page", () => {
  let calls: { url: string; method: string; body?: unknown }[];
  beforeEach(() => {
    calls = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
        const url = String(input);
        const method = init.method ?? "GET";
        calls.push({
          url,
          method,
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        const json = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), { status });
        if (url.endsWith("/factory-api/runs")) return json({ runs: RUNS });
        if (url.endsWith("/factory-api/projects"))
          return json({
            projects: [
              {
                id: "autoriz",
                repo: "o/r",
                active: true,
                defaultWorkflow: "bugfix",
                enabledWorkflows: ["bugfix"],
                commands: [],
              },
            ],
          });
        if (url.endsWith("/factory-api/workflows"))
          return json({
            workflows: [
              {
                id: "bugfix",
                name: "Bugfix",
                description: "Corriger un bug",
                builtin: true,
                archived: false,
                latestVersion: 1,
                updatedAt: "",
              },
            ],
          });
        if (url.endsWith("/factory-api/status"))
          return json({
            control: { paused: false, by: null, at: null, reason: "" },
            quota: {
              suspended: [
                {
                  runId: 2,
                  project: "autoriz",
                  issue: 9002,
                  until: "2026-11-22T14:00:00Z",
                },
              ],
              last: null,
            },
            push: false,
            capacity: { global: 2, active: 1 },
          });
        if (url.endsWith("/factory-api/control"))
          return json({
            control: { paused: true, by: "dev", at: null, reason: "" },
          });
        if (url.endsWith("/factory-api/runs/1/review"))
          return json({
            run: {
              id: 1,
              issue: 9001,
              title: "Export PDF",
              prNumber: null,
              conversationId: "c1",
              workflow: "speckit-full",
            },
            node: {
              id: "spec_review",
              label: "Revue de la spec",
              title: "Spécification à valider",
              what: "la spec",
              instructions: "",
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
            },
            files: [
              {
                path: "specs/spec.md",
                content: "# Spec PDF\n\nContenu",
                truncated: false,
              },
            ],
          });
        if (url.endsWith("/factory-api/runs/1/decide"))
          return json({ ok: true, via: "canvas" });
        return json({ runId: 9 });
      }) as typeof fetch,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  const renderPage = (path = "/tickets") =>
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter initialEntries={[path]}>
          <TicketsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it("shows each run in its column, decision first, with links", async () => {
    renderPage("/tickets?run=3");
    const human = await screen.findByTestId("tickets-column-human");
    expect(within(human).getByText("Export PDF")).toBeInTheDocument();
    expect(within(human).getByText("Revue de la spec")).toBeInTheDocument();
    expect(screen.getByTestId("ticket-decide-1")).toHaveTextContent("Décider");
    expect(screen.getByTestId("ticket-open-1")).toHaveAttribute(
      "href",
      "/conversations/c1",
    );
    expect(
      within(screen.getByTestId("tickets-column-queued")).getByText(
        /s’ouvrira/,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("tickets-column-failed")).getByText(
        "maxVisits atteint",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("tickets-count-human")).toHaveTextContent("1");
    expect(screen.getByTestId("ticket-card-3").className).toContain("ring-2");
  });

  it("decides from the dashboard: files shown, comment required, approval confirmed", async () => {
    renderPage();
    await userEvent.click(await screen.findByTestId("ticket-decide-1"));
    expect(
      await screen.findByText("Spécification à valider"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Spec PDF")).toBeInTheDocument();
    // "changes" needs a comment: nothing is sent without it.
    await userEvent.click(screen.getByTestId("review-outcome-changes"));
    expect(calls.some((c) => c.url.endsWith("/decide"))).toBe(false);
    // Approval is asked twice.
    await userEvent.click(screen.getByTestId("review-outcome-approve"));
    expect(screen.getByTestId("review-outcome-approve")).toHaveTextContent(
      "Confirmer",
    );
    expect(calls.some((c) => c.url.endsWith("/decide"))).toBe(false);
    await userEvent.click(screen.getByTestId("review-outcome-approve"));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/decide"))?.body).toEqual({
        outcome: "approve",
        comment: "",
      }),
    );
  });

  it("shows the quota and pauses the factory after confirmation", async () => {
    renderPage();
    expect(await screen.findByTestId("factory-quota")).toHaveTextContent(
      "1 run(s)",
    );
    await userEvent.click(screen.getByTestId("factory-pause-toggle"));
    expect(calls.some((c) => c.url.endsWith("/control"))).toBe(false);
    await userEvent.click(screen.getByTestId("factory-pause-toggle"));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/control"))?.body).toMatchObject(
        { paused: true },
      ),
    );
  });

  it("retries a failed run after confirmation", async () => {
    renderPage();
    const retry = await screen.findByTestId("ticket-retry-4");
    await userEvent.click(retry);
    expect(
      calls.some((c) => c.method === "POST" && c.url.endsWith("/runs")),
    ).toBe(false);
    await userEvent.click(screen.getByTestId("ticket-retry-4"));
    await waitFor(() =>
      expect(
        calls.find((c) => c.method === "POST" && c.url.endsWith("/runs"))?.body,
      ).toEqual({
        projectId: "autoriz",
        issue: 9005,
        workflowId: "bugfix",
      }),
    );
  });
});

describe("task type picker", () => {
  const options: FactoryTaskOptions[] = [
    {
      project: {
        id: "autoriz",
        repo: "o/r",
        active: true,
        defaultWorkflow: "bugfix",
        enabledWorkflows: ["bugfix"],
        commands: [],
      },
      workflows: [
        {
          id: "bugfix",
          name: "Bugfix",
          description: "Corriger un bug",
          builtin: true,
          archived: false,
          latestVersion: 1,
          updatedAt: "",
        },
      ],
    },
  ];

  it("offers plain chat and the project's workflows", async () => {
    const onChange = vi.fn();
    render(
      <FactoryTaskTypePicker
        choice={null}
        options={options}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId("factory-task-type")).toHaveTextContent(
      "Chat libre",
    );
    await userEvent.click(screen.getByTestId("factory-task-type"));
    expect(screen.getByText("Bugfix (par défaut)")).toBeInTheDocument();
    await userEvent.click(
      screen.getByTestId("factory-task-type-autoriz-bugfix"),
    );
    expect(onChange).toHaveBeenCalledWith({
      projectId: "autoriz",
      workflowId: "bugfix",
    });
  });

  it("hides itself without factory projects", () => {
    const { container } = render(
      <FactoryTaskTypePicker
        choice={null}
        options={[]}
        onChange={() => undefined}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("project page", () => {
  let calls: { url: string; method: string; body?: unknown }[];
  beforeEach(() => {
    calls = [];
    useFactoryProjectStore.getState().setProjectId("autoriz");
    vi.spyOn(globalThis, "fetch").mockImplementation(
      vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
        const url = String(input);
        const method = init.method ?? "GET";
        calls.push({
          url,
          method,
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        const json = (data: unknown) =>
          new Response(JSON.stringify(data), { status: 200 });
        if (url.endsWith("/factory-api/projects"))
          return json({
            projects: [
              {
                id: "autoriz",
                repo: "o/r",
                active: true,
                defaultWorkflow: "bugfix",
                enabledWorkflows: ["bugfix"],
                commands: ["test"],
                settings: { notify: { events: ["human"] } },
                config: {
                  defaultBranch: "main",
                  concurrency: 1,
                  labels: {},
                  githubProject: false,
                },
              },
            ],
          });
        if (url.endsWith("/factory-api/workflows"))
          return json({
            workflows: [
              {
                id: "bugfix",
                name: "Bugfix",
                description: "",
                builtin: true,
                archived: false,
                latestVersion: 1,
                updatedAt: "",
              },
            ],
          });
        if (url.endsWith("/factory-api/workflows/bugfix"))
          return json({
            workflow: { name: "Bugfix" },
            versions: [],
            definition: {
              schema: 1,
              name: "Bugfix",
              description: "",
              nodes: [
                {
                  id: "fix",
                  type: "end",
                  label: "Correctif",
                  config: { result: "completed" },
                },
              ],
              edges: [],
            },
          });
        if (url.endsWith("/factory-api/status"))
          return json({
            control: { paused: false, by: null, at: null, reason: "" },
            quota: { suspended: [], last: null },
            push: true,
            capacity: { global: 2, active: 0 },
          });
        return json({ ok: true, settings: {} });
      }) as typeof fetch,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    useFactoryProjectStore.getState().setProjectId("");
  });

  it("edits the board columns and saves them with the notification settings", async () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <FactoryProjectPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByTestId("project-columns");
    expect(screen.getByTestId("notify-human")).toBeChecked();
    expect(screen.getByTestId("notify-failed")).not.toBeChecked();
    await userEvent.click(screen.getByTestId("column-add"));
    const title = screen.getByTestId("column-title-nouvelle");
    await userEvent.clear(title);
    await userEvent.type(title, "Correctif");
    await userEvent.click(screen.getByTestId("column-nouvelle-state-ACTIVE"));
    await waitFor(() =>
      expect(screen.getByTestId("column-nouvelle-add-node")).toHaveTextContent(
        "Bugfix › Correctif",
      ),
    );
    await userEvent.selectOptions(
      screen.getByTestId("column-nouvelle-add-node"),
      "bugfix/fix",
    );
    await userEvent.click(screen.getByTestId("columns-save"));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/settings"))).toBeTruthy(),
    );
    const body = calls.find((c) => c.url.endsWith("/settings"))!.body as {
      settings: {
        notify: unknown;
        columns: {
          id: string;
          title: string;
          states: string[];
          nodes: string[];
        }[];
      };
    };
    expect(body.settings.notify).toEqual({ events: ["human"] });
    expect(body.settings.columns).toHaveLength(6);
    expect(body.settings.columns.at(-1)).toMatchObject({
      id: "nouvelle",
      title: "Correctif",
      states: ["ACTIVE"],
      nodes: ["bugfix/fix"],
    });
  });
});

describe("workflow stats overlay", () => {
  it("puts each node's statistics on its card data", () => {
    const def = {
      schema: 1,
      name: "W",
      description: "",
      nodes: [{ id: "fix", type: "end", config: { result: "completed" } }],
      edges: [],
      settings: {},
      layout: {},
    } as unknown as Parameters<typeof toFlow>[0];
    const stats = {
      node: "fix",
      entries: 3,
      runs: 2,
      medianSeconds: 600,
      avgSeconds: 700,
      maxSeconds: 900,
      loops: 1,
      failedHere: 0,
      activeHere: 0,
    };
    expect(
      toFlow(def, { readOnly: true }).nodes[0]!.data.stats,
    ).toBeUndefined();
    expect(
      toFlow(def, { readOnly: true, statsByNode: new Map([["fix", stats]]) })
        .nodes[0]!.data.stats,
    ).toEqual(stats);
    expect(
      toFlow(def, { readOnly: true, statsByNode: new Map() }).nodes[0]!.data
        .stats,
    ).toBeNull();
  });
});
