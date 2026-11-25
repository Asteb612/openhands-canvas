import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FactoryProject,
  MemObservation,
  MemOverview,
} from "#/factory/api";
import MemoryPage from "#/factory/memory-page";

const PROJECT: FactoryProject = {
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
  enabledWorkflows: ["light"],
  commands: ["test"],
};

vi.mock("#/factory/project-context", async (orig) => ({
  ...(await orig<typeof import("#/factory/project-context")>()),
  useSelectedProject: () => ({
    projectId: "autoriz",
    project: PROJECT,
    projects: [PROJECT],
    setProjectId: vi.fn(),
  }),
}));

const overview = (
  over: Partial<Extract<MemOverview, { available: true }>> = {},
): MemOverview => ({
  available: true,
  plugin: { installed: true, enabled: true },
  worker: { version: "16.1.3", uptimeSeconds: 60 },
  stats: {
    observations: 12,
    sessions: 3,
    summaries: 2,
    dbBytes: 5 * 1024 * 1024,
    firstObservationAt: "2026-11-01T00:00:00Z",
  },
  processing: { active: false, queueDepth: 0 },
  settings: {
    observerEnabled: true,
    model: "haiku",
    contextObservations: 50,
    skipSubagentObservations: false,
    redact: false,
  },
  compliance: {
    provider: "claude",
    authMethod: "subscription",
    fallbackProvider: "",
    ok: true,
  },
  projects: ["repo", "autoriz"],
  ...over,
});

const obs: MemObservation = {
  id: 7,
  project: "repo",
  type: "decision",
  title: "Hasura via JWT",
  subtitle: "auth",
  narrative: "Le backend signe des JWT pour Hasura.",
  facts: ["clé dans le vault"],
  concepts: [],
  filesRead: [],
  filesModified: ["src/auth.ts"],
  createdAt: "2026-11-25T08:00:00Z",
};

describe("Memory page (Claude-Mem)", () => {
  let state: MemOverview;
  const calls: { url: string; method: string; body?: unknown }[] = [];
  beforeEach(() => {
    state = overview();
    calls.length = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
        const url = String(input);
        const method = init.method ?? "GET";
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url, method, body });
        const json = (d: unknown, status = 200) =>
          new Response(JSON.stringify(d), { status });
        const path = url.split("?")[0]!;
        if (path === "/factory-api/projects/autoriz/memory") return json(state);
        if (path === "/factory-api/projects/autoriz/memory/observations")
          return json({ items: [obs], hasMore: false });
        if (
          path === "/factory-api/projects/autoriz/memory/observations/7" &&
          method === "DELETE"
        )
          return json({ ok: true });
        if (path === "/factory-api/projects/autoriz/memory/settings") {
          if (state.available)
            state = { ...state, settings: { ...state.settings, ...body } };
          return json(state);
        }
        if (path === "/factory-api/projects/autoriz/memory/plugin")
          return json({ plugin: { installed: true, enabled: body.enabled } });
        return json({ error: "not found" }, 404);
      }),
    );
  });

  const renderPage = () =>
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter initialEntries={["/factory/memory"]}>
          <MemoryPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it("shows the stats, the subscription compliance and the observations; opens one", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByTestId("mem-compliance")).toHaveTextContent(
      /claude.*subscription/,
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    const row = await screen.findByTestId("mem-obs-7");
    expect(row).toHaveTextContent("Hasura via JWT");
    await user.click(within(row).getByText("Hasura via JWT"));
    expect(screen.getByTestId("mem-obs-7-details")).toHaveTextContent(
      /signe des JWT[\s\S]*clé dans le vault[\s\S]*src\/auth\.ts/,
    );
  });

  it("searches, filters by folder, and deletes an observation after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("mem-obs-7");
    await user.selectOptions(screen.getByTestId("mem-project"), "repo");
    await user.type(screen.getByTestId("mem-search"), "jwt");
    await user.click(screen.getByTestId("mem-search-go"));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url.includes("/memory/observations?") &&
            c.url.includes("q=jwt") &&
            c.url.includes("project=repo"),
        ),
      ).toBe(true),
    );
    await user.click(screen.getByTestId("mem-obs-7-delete"));
    // The confirmation modal's button (the row's trash icon has the same name).
    const buttons = await screen.findAllByRole("button", {
      name: /^Supprimer$|^Delete$/,
    });
    await user.click(buttons.at(-1)!);
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "DELETE" && c.url.endsWith("/memory/observations/7"),
        ),
      ).toBe(true),
    );
  });

  it("turns the observer off and the plugin off (confirmed)", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByTestId("mem-observer"));
    await waitFor(() =>
      expect(
        calls.find(
          (c) => c.method === "PUT" && c.url.endsWith("/memory/settings"),
        )?.body,
      ).toEqual({ observerEnabled: false }),
    );
    await user.click(screen.getByTestId("mem-plugin"));
    await user.click(
      await screen.findByRole("button", { name: /^Désactiver$|^Turn off$/ }),
    );
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/memory/plugin"))?.body).toEqual(
        { enabled: false },
      ),
    );
  });

  it("warns when the observer is not on the subscription, and when the worker is down", async () => {
    state = overview({
      compliance: {
        provider: "openrouter",
        authMethod: "api-key",
        fallbackProvider: "",
        ok: false,
      },
    });
    const { unmount } = renderPage();
    expect(await screen.findByTestId("mem-compliance")).toHaveTextContent(
      /openrouter/,
    );
    unmount();
    state = {
      available: false,
      reason: "worker absent",
      plugin: { installed: true, enabled: false },
    };
    renderPage();
    expect(await screen.findByTestId("mem-unavailable")).toHaveTextContent(
      "worker absent",
    );
    expect(screen.getByTestId("mem-plugin")).toBeInTheDocument();
  });
});
