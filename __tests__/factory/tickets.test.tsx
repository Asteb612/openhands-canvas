import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FactoryProject, FactoryRun } from "#/factory/api";
import {
  columnMatches,
  defaultColumns,
  groupRuns,
  isHistoryColumn,
} from "#/factory/tickets/columns";
import { formatDuration, since } from "#/factory/format";
import { factoryT } from "#/factory/i18n";
import { diffAlerts } from "#/factory/notifier";
import {
  FactoryTaskTypePicker,
  splitTask,
  type FactoryTaskOptions,
} from "#/factory/task-type";
import {
  conversationPath,
  projectBackends,
  projectOfBackend,
} from "#/factory/project-context";

const t = (
  k: Parameters<typeof factoryT>[1],
  v?: Record<string, string | number>,
) => factoryT("fr", k, v);

// The active project (= Canvas backend) is mocked: the tests do not mount the Canvas providers.
const selected = vi.hoisted(() => ({ projectId: "autoriz" as string }));
vi.mock("#/factory/project-context", async (orig) => {
  const real = await orig<typeof import("#/factory/project-context")>();
  return {
    ...real,
    useSelectedProject: () => {
      const projects =
        (globalThis as { __projects?: FactoryProject[] }).__projects ?? [];
      const project = projects.find((p) => p.id === selected.projectId);
      return {
        projectId: project ? project.id : "",
        project,
        projects,
        setProjectId: vi.fn(),
      };
    },
  };
});

const project = (over: Partial<FactoryProject> = {}): FactoryProject => ({
  id: "autoriz",
  name: "Autoriz",
  repo: "o/r",
  status: "ok",
  error: null,
  active: true,
  subscription: "default",
  paused: null,
  backend: { id: "factory-autoriz", path: "/agents/autoriz" },
  defaultWorkflow: "bugfix",
  enabledWorkflows: ["bugfix"],
  commands: ["test"],
  settings: { notify: { events: ["human"] }, paused: null },
  config: {
    defaultBranch: "main",
    concurrency: 1,
    labels: {},
    githubProject: false,
  },
  ...over,
});

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
  run({
    id: 6,
    project: "perso",
    issue: 12,
    state: "HUMAN",
    title: "Flux RSS",
    conversationId: "p1",
    repo: "me/blog",
  }),
];

describe("helpers", () => {
  it("groups runs by default columns with filters", () => {
    const g = groupRuns(RUNS, { project: "autoriz" }, defaultColumns(t)).groups;
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
    expect(
      groupRuns(RUNS, {}, defaultColumns(t)).groups.human!.map((r) => r.issue),
    ).toEqual([9001, 12]);
    expect(
      groupRuns(RUNS, { text: "revue" }, defaultColumns(t)).groups.active,
    ).toHaveLength(0);
  });

  it("custom columns: first match wins; leftovers go to Other", () => {
    const columns = [
      { id: "fix", title: "Correctif", nodes: ["bugfix/fix"] },
      { id: "end", title: "Fini", states: ["COMPLETED", "CANCELLED"] },
    ];
    const { columns: cols, groups } = groupRuns(
      RUNS,
      { project: "autoriz" },
      columns.slice(0, 1),
      { title: "Autres" },
    );
    expect(cols.map((c) => c.id)).toEqual(["fix", "__other"]);
    expect(groups.__other!.map((r) => r.issue)).toEqual([9004]);
    expect(isHistoryColumn(columns[1]!)).toBe(true);
    expect(
      columnMatches({ id: "x", title: "x", nodeTypes: ["human"] }, RUNS[0]!),
    ).toBe(false);
  });

  it("formats durations in the Canvas language", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    expect(since(t, "2026-11-22T11:59:30Z", now)).toBe("à l'instant");
    expect(since(t, "2026-11-22T09:00:00Z", now)).toBe("3 h");
    expect(formatDuration(t, 3 * 3600 + 20 * 60)).toBe("3 h 20");
    expect(formatDuration((k, v) => factoryT("en", k, v), 52 * 3600)).toBe(
      "2 d 4 h",
    );
    expect(formatDuration(t, null)).toBe("—");
  });

  it("splits a typed task into an issue title and body", () => {
    expect(splitTask("  Corriger le PDF\n\nIl plante  ")).toEqual({
      title: "Corriger le PDF",
      body: "Corriger le PDF\n\nIl plante",
    });
    expect(splitTask("x".repeat(200)).title).toHaveLength(118);
  });

  it("alerts only on runs that newly need the owner, linking to the run's project backend", () => {
    expect(diffAlerts(null, RUNS)).toEqual([]);
    const before = new Map(RUNS.map((r) => [r.id, r.state]));
    before.set(6, "ACTIVE");
    const alerts = diffAlerts(before, RUNS, "fr");
    expect(alerts).toEqual([
      expect.objectContaining({
        title: "[perso] #12 à valider",
        to: "/conversations/p1?backend=factory-perso",
      }),
    ]);
  });

  it("project = backend: one backend per project, no key, others kept", () => {
    const current = [
      {
        id: "local-x",
        name: "Local",
        host: "http://h",
        apiKey: "k",
        kind: "local" as const,
      },
    ];
    const next = projectBackends(
      current,
      [
        project(),
        project({
          id: "perso",
          name: "Perso",
          backend: { id: "factory-perso", path: "/agents/perso" },
        }),
      ],
      "https://factory.example",
    );
    expect(next.map((b) => [b.id, b.host, b.apiKey])).toEqual([
      ["local-x", "http://h", "k"],
      ["factory-autoriz", "https://factory.example/agents/autoriz", ""],
      ["factory-perso", "https://factory.example/agents/perso", ""],
    ]);
    expect(projectOfBackend("factory-perso")).toBe("perso");
    expect(projectOfBackend("local-x")).toBeNull();
    expect(conversationPath("perso", "c9")).toBe(
      "/conversations/c9?backend=factory-perso",
    );
  });
});

describe("tickets page", () => {
  let calls: { url: string; method: string; body?: unknown }[];
  beforeEach(() => {
    calls = [];
    selected.projectId = "autoriz";
    (globalThis as { __projects?: FactoryProject[] }).__projects = [
      project(),
      project({
        id: "perso",
        name: "Perso",
        backend: { id: "factory-perso", path: "/agents/perso" },
      }),
    ];
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
        if (url.endsWith("/factory-api/runs") && method === "GET")
          return json({ runs: RUNS });
        if (url.endsWith("/factory-api/status"))
          return json({
            control: { paused: false, by: null, at: null, reason: "" },
            subscriptions: [
              {
                id: "default",
                label: "Pro",
                projects: ["autoriz"],
                suspendedUntil: "2026-11-22T14:00:00Z",
                last: null,
              },
            ],
            projects: [],
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
              project: "autoriz",
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

  const renderPage = async (path = "/factory/tickets") => {
    const { default: TicketsPage } =
      await import("#/factory/tickets/tickets-page");
    return render(
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
  };

  it("shows the active project's runs by column, conversation links on the project's backend", async () => {
    await renderPage("/factory/tickets?run=3");
    const human = await screen.findByTestId("tickets-column-human");
    expect(within(human).getByText("Export PDF")).toBeInTheDocument();
    expect(within(human).queryByText("Flux RSS")).toBeNull(); // other project
    expect(screen.getByTestId("ticket-open-1")).toHaveAttribute(
      "href",
      "/conversations/c1?backend=factory-autoriz",
    );
    expect(
      within(screen.getByTestId("tickets-column-failed")).getByText(
        "maxVisits atteint",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("tickets-need-me")).toHaveTextContent("1");
    expect(screen.getByTestId("ticket-card-3").className).toContain("ring-2");
  });

  it("all projects: every project's runs, with the project shown and its own backend", async () => {
    await renderPage("/factory/tickets?scope=all");
    const human = await screen.findByTestId("tickets-column-human");
    expect(within(human).getByText("Flux RSS")).toBeInTheDocument();
    expect(screen.getByTestId("ticket-open-6")).toHaveAttribute(
      "href",
      "/conversations/p1?backend=factory-perso",
    );
    expect(screen.getByTestId("tickets-need-me")).toHaveTextContent("2");
  });

  it("decides from the dashboard: files shown, comment required, approval confirmed in the modal", async () => {
    await renderPage();
    await userEvent.click(await screen.findByTestId("ticket-decide-1"));
    expect(
      await screen.findByText("Spécification à valider"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Spec PDF")).toBeInTheDocument();
    expect(screen.getByTestId("review-outcome-changes")).toBeDisabled(); // comment required
    await userEvent.click(screen.getByTestId("review-outcome-approve"));
    expect(calls.some((c) => c.url.endsWith("/decide"))).toBe(false);
    await userEvent.click(await screen.findByTestId("confirm-button"));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/decide"))?.body).toEqual({
        outcome: "approve",
        comment: "",
      }),
    );
  });

  it("shows each subscription's quota and pauses the factory after confirmation", async () => {
    await renderPage();
    expect(
      await screen.findByTestId("factory-quota-default"),
    ).toHaveTextContent("Pro");
    await userEvent.click(screen.getByTestId("factory-pause-toggle"));
    expect(calls.some((c) => c.url.endsWith("/control"))).toBe(false);
    await userEvent.click(await screen.findByTestId("confirm-button"));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/control"))?.body).toMatchObject(
        { paused: true },
      ),
    );
  });

  it("retries a failed run after confirmation", async () => {
    await renderPage();
    await userEvent.click(await screen.findByTestId("ticket-retry-4"));
    await userEvent.click(await screen.findByTestId("confirm-button"));
    await waitFor(() =>
      expect(
        calls.find(
          (c) => c.method === "POST" && c.url.endsWith("/factory-api/runs"),
        )?.body,
      ).toEqual({ projectId: "autoriz", issue: 9005, workflowId: "bugfix" }),
    );
  });
});

describe("task type picker", () => {
  const options: FactoryTaskOptions[] = [
    {
      project: project(),
      workflows: [
        {
          scope: "autoriz",
          id: "bugfix",
          name: "Bugfix",
          description: "Corriger un bug",
          builtin: false,
          archived: false,
          latestVersion: 1,
          updatedAt: "",
        },
      ],
    },
  ];

  it("offers plain chat and the active project's workflows", async () => {
    const onChange = vi.fn();
    render(
      <FactoryTaskTypePicker
        choice={null}
        options={options}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByTestId("factory-task-type"));
    await userEvent.click(
      screen.getByTestId("factory-task-type-autoriz-bugfix"),
    );
    expect(onChange).toHaveBeenCalledWith({
      projectId: "autoriz",
      workflowId: "bugfix",
    });
  });

  it("hides itself without factory workflows", () => {
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
    selected.projectId = "autoriz";
    (globalThis as { __projects?: FactoryProject[] }).__projects = [project()];
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
        if (url.endsWith("/factory-api/projects/autoriz/workflows"))
          return json({
            workflows: [
              {
                scope: "autoriz",
                id: "bugfix",
                name: "Bugfix",
                description: "",
                builtin: false,
                archived: false,
                latestVersion: 1,
                source: "bugfix@1",
                updatedAt: "",
                templateUpdate: { templateId: "bugfix", from: 1, to: 2 },
              },
            ],
          });
        if (url.endsWith("/factory-api/projects/autoriz/workflows/bugfix"))
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
            subscriptions: [
              {
                id: "default",
                label: "Pro",
                projects: ["autoriz"],
                suspendedUntil: null,
                last: null,
              },
            ],
            projects: [],
            push: true,
            capacity: { global: 2, active: 0 },
          });
        return json({ ok: true, settings: {} });
      }) as typeof fetch,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  const renderProject = async () => {
    const { default: FactoryProjectPage } =
      await import("#/factory/project-page");
    return render(
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
  };

  it("edits the board columns and saves them with the notification settings", async () => {
    await renderProject();
    await screen.findByTestId("project-columns");
    expect(screen.getByTestId("notify-human")).toBeChecked();
    expect(screen.getByTestId("notify-failed")).not.toBeChecked();
    expect(await screen.findByText("Pro")).toBeInTheDocument(); // subscription label
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

  it("pauses the project after confirmation", async () => {
    await renderProject();
    await userEvent.click(await screen.findByTestId("project-pause"));
    await userEvent.click(await screen.findByTestId("confirm-button"));
    await waitFor(() =>
      expect(
        calls.find((c) => c.url.endsWith("/projects/autoriz/pause"))?.body,
      ).toMatchObject({ paused: true }),
    );
  });

  it("shows why a project is disabled", async () => {
    (globalThis as { __projects?: FactoryProject[] }).__projects = [
      project({ status: "error", error: "missing secret env var GH_X" }),
    ];
    await renderProject();
    expect(
      await screen.findByText(/missing secret env var GH_X/),
    ).toBeInTheDocument();
  });
});
