import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TicketsPage, { groupRuns, since } from "#/factory/tickets/tickets-page";
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
    const g = groupRuns(RUNS, {});
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
    expect(groupRuns(RUNS, { text: "revue" }).human).toHaveLength(1);
    expect(groupRuns(RUNS, { text: "revue" }).active).toHaveLength(0);
    expect(groupRuns(RUNS, { workflow: "spike" }).done).toHaveLength(1);
    expect(groupRuns(RUNS, { project: "other" }).human).toHaveLength(0);
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
        if (url.endsWith("/factory-api/runs") && method === "POST")
          return json({ runId: 9 });
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
    expect(screen.getByTestId("ticket-open-1")).toHaveTextContent("Décider");
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

  it("retries a failed run after confirmation", async () => {
    renderPage();
    const retry = await screen.findByTestId("ticket-retry-4");
    await userEvent.click(retry);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    await userEvent.click(screen.getByTestId("ticket-retry-4"));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({
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
