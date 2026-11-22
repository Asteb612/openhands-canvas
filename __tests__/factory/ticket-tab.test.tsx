import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseFactoryTicket, type FactoryTicket } from "#/factory/ticket";
import { FactoryTicketView } from "#/factory/ticket-tab";

const render = (ui: React.ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

vi.mock("#/hooks/use-conversation-id", () => ({
  useOptionalConversationId: () => ({ conversationId: "conv-1" }),
  useConversationId: () => ({ conversationId: "conv-1" }),
}));
const mockOpenFile = vi.fn();
vi.mock("#/services/canvas-ui", () => ({
  openWorkspaceFile: (p: string) => mockOpenFile(p),
}));

const base: FactoryTicket = {
  version: 1,
  issue: 552,
  title: "Étude urbaine",
  url: "https://github.com/o/r/issues/552",
  repo: "o/r",
  branch: "factory/552-etude",
  state: "HUMAN",
  stateLabel: "Spec à valider",
  steps: [
    { key: "spec", label: "Spec", status: "review" },
    { key: "plan", label: "Plan", status: "todo" },
  ],
  pr: null,
  review: { what: "la spécification", files: ["specs/spec.md"] },
  updatedAt: "2026-11-21T18:00:00Z",
};

describe("factory ticket tab", () => {
  let calls: { url: string; body?: unknown }[];
  beforeEach(() => {
    calls = [];
    mockOpenFile.mockReset();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
        const url = String(input);
        calls.push({
          url,
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        const json = (d: unknown) =>
          new Response(JSON.stringify(d), { status: 200 });
        if (url.endsWith("/runs/7/review"))
          return json({
            run: {
              id: 7,
              project: "autoriz",
              issue: 552,
              title: "Étude urbaine",
              prNumber: null,
              conversationId: "conv-1",
              workflow: "speckit-full",
            },
            node: {
              id: "spec_review",
              label: "Revue",
              title: "Spécification à valider",
              what: "la spécification",
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
                {
                  id: "drop",
                  label: "Abandonner",
                  kind: "reject",
                  requireComment: false,
                },
              ],
            },
            files: [
              { path: "specs/spec.md", content: "# Spec", truncated: false },
            ],
          });
        return json({ ok: true, via: "canvas" });
      }) as typeof fetch,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("parses a valid card and rejects anything else", () => {
    expect(parseFactoryTicket(JSON.stringify(base))?.issue).toBe(552);
    expect(parseFactoryTicket("{")).toBeNull();
    expect(
      parseFactoryTicket(JSON.stringify({ ...base, version: 2 })),
    ).toBeNull();
  });

  it("shows state and steps", () => {
    render(<FactoryTicketView ticket={{ ...base, review: null }} />);
    expect(screen.getByTestId("factory-state")).toHaveTextContent(
      "Spec à valider",
    );
    expect(screen.getByText("Spec")).toBeInTheDocument();
    expect(screen.queryByTestId("factory-decision")).toBeNull();
  });

  it("decides through the same panel as the dashboard; files open in Canvas' viewer", async () => {
    render(<FactoryTicketView ticket={base} runId={7} project="autoriz" />);
    expect(
      await screen.findByText("Spécification à valider"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /specs\/spec\.md/ }));
    expect(mockOpenFile).toHaveBeenCalledWith("specs/spec.md");
    expect(screen.getByTestId("review-outcome-changes")).toBeDisabled();
    await userEvent.type(
      screen.getByTestId("review-comment"),
      "Préciser le format",
    );
    await userEvent.click(screen.getByTestId("review-outcome-changes"));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/runs/7/decide"))?.body).toEqual(
        { outcome: "changes", comment: "Préciser le format" },
      ),
    );
  });

  it("asks a confirmation before a rejection", async () => {
    render(<FactoryTicketView ticket={base} runId={7} project="autoriz" />);
    await userEvent.click(await screen.findByTestId("review-outcome-drop"));
    expect(calls.some((c) => c.url.endsWith("/decide"))).toBe(false);
    await userEvent.click(await screen.findByTestId("confirm-button"));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/runs/7/decide"))?.body).toEqual(
        { outcome: "drop", comment: "" },
      ),
    );
  });

  it("without the factory API, explains how to decide in the conversation", () => {
    render(<FactoryTicketView ticket={base} />);
    expect(screen.getByText(/\/decide/)).toBeInTheDocument();
  });
});
