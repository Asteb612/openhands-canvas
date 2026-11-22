import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseFactoryTicket, type FactoryTicket } from "#/factory/ticket";
import { FactoryTicketView } from "#/factory/ticket-tab";
import { useOptimisticUserMessageStore } from "#/stores/optimistic-user-message-store";

const mockSend = vi.fn().mockResolvedValue({ queued: false });
vi.mock("#/hooks/use-send-message", () => ({
  useSendMessage: () => ({ send: mockSend }),
}));
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
  state: "SPEC_REVIEW",
  stateLabel: "Spec à valider",
  steps: [
    { key: "spec", label: "Spec", status: "review" },
    { key: "plan", label: "Plan", status: "todo" },
  ],
  pr: null,
  review: { what: "la spécification", files: ["specs/spec.md"] },
  updatedAt: "2026-11-21T18:00:00Z",
};

const sentTexts = () =>
  mockSend.mock.calls.map(
    (c) => (c[0] as { args: { content: string } }).args.content,
  );

describe("factory ticket", () => {
  beforeEach(() => {
    mockSend.mockClear();
    mockOpenFile.mockClear();
    useOptimisticUserMessageStore.getState().clearPendingMessages();
  });

  it("parses a valid card and rejects anything else", () => {
    expect(parseFactoryTicket(JSON.stringify(base))?.issue).toBe(552);
    expect(parseFactoryTicket("not json")).toBeNull();
    expect(
      parseFactoryTicket(JSON.stringify({ ...base, version: 2 })),
    ).toBeNull();
    expect(parseFactoryTicket(JSON.stringify({ issue: 1 }))).toBeNull();
  });

  it("shows state, steps and the files to review", async () => {
    render(<FactoryTicketView ticket={base} />);
    expect(screen.getByTestId("factory-state")).toHaveTextContent(
      "Spec à valider",
    );
    expect(screen.getByTestId("factory-steps")).toHaveTextContent("Spec");
    await userEvent.click(screen.getByText("specs/spec.md"));
    expect(mockOpenFile).toHaveBeenCalledWith("specs/spec.md");
  });

  it("approves only after an explicit confirmation", async () => {
    const user = userEvent.setup();
    render(<FactoryTicketView ticket={base} />);
    await user.click(screen.getByTestId("factory-outcome-approve"));
    expect(mockSend).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("factory-outcome-approve"));
    expect(sentTexts()).toEqual(["/decide approve"]);
    expect(screen.getByTestId("factory-decision-sent")).toBeInTheDocument();
  });

  it("sends the changes choice with the remarks, never an empty one", async () => {
    const user = userEvent.setup();
    render(<FactoryTicketView ticket={base} />);
    expect(screen.getByTestId("factory-outcome-changes")).toBeDisabled();
    await user.type(
      screen.getByTestId("factory-remarks"),
      "Ajoute le cas limite X",
    );
    await user.click(screen.getByTestId("factory-outcome-changes"));
    expect(sentTexts()).toEqual(["/decide changes Ajoute le cas limite X"]);
  });

  it("draws one button per workflow outcome", async () => {
    const user = userEvent.setup();
    render(
      <FactoryTicketView
        ticket={{
          ...base,
          workflow: { id: "bugfix", version: 2, name: "Correctif" },
          review: {
            what: "le test manuel",
            files: [],
            outcomes: [
              {
                id: "ok",
                label: "Testé, OK",
                kind: "approve",
                requireComment: false,
              },
              {
                id: "retest",
                label: "À refaire",
                kind: "changes",
                requireComment: true,
              },
              {
                id: "drop",
                label: "Abandonner",
                kind: "reject",
                requireComment: false,
              },
              {
                id: "later",
                label: "Plus tard",
                kind: "other",
                requireComment: false,
              },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText(/workflow Correctif \(v2\)/)).toBeInTheDocument();
    expect(screen.getByTestId("factory-outcome-retest")).toBeDisabled();
    await user.click(screen.getByTestId("factory-outcome-drop"));
    expect(mockSend).not.toHaveBeenCalled(); // rejection needs a confirmation
    await user.click(screen.getByTestId("factory-outcome-later"));
    expect(sentTexts()).toEqual(["/decide later"]);
  });

  it("has no decision box when nothing is awaited", () => {
    render(
      <FactoryTicketView
        ticket={{ ...base, state: "PLANNING", review: null }}
      />,
    );
    expect(screen.queryByTestId("factory-decision")).not.toBeInTheDocument();
  });
});
