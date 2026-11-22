/* eslint-disable i18next/no-literal-string -- factory UI is French-only */
import React from "react";
import { Link } from "react-router";
import { cn } from "#/utils/utils";
import { useSelectConversationTab } from "#/hooks/use-select-conversation-tab";
import { useFactoryTicket, type FactoryTicket } from "./ticket";
import { RunStateChip } from "./run-status";
import { WorkflowPreview } from "./workflows/workflow-preview";

const STEP_TONE: Record<string, string> = {
  done: "border-border text-muted",
  current: "border-contrast text-foreground font-semibold",
  review: "border-feedback-warning text-feedback-warning font-semibold",
  todo: "border-border text-muted opacity-60",
};

export function workflowEditorLink(ticket: FactoryTicket): string | null {
  if (!ticket.workflow) return null;
  const q = new URLSearchParams({ wf: ticket.workflow.id });
  if (ticket.node) q.set("node", ticket.node);
  return `/workflows?${q.toString()}`;
}

/** Visible workflow status at the top of a factory ticket conversation. */
export function FactoryBannerView({
  ticket,
  onDecide,
}: {
  ticket: FactoryTicket;
  onDecide: () => void;
}) {
  const [showGraph, setShowGraph] = React.useState(false);
  const editLink = workflowEditorLink(ticket);
  return (
    <div
      className={cn(
        "mx-2 mb-2 flex flex-col gap-2 rounded-md border bg-surface px-3 py-2",
        ticket.review ? "border-feedback-warning" : "border-border",
      )}
      data-testid="factory-banner"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span aria-hidden>🏭</span>
        {ticket.url ? (
          <a
            href={ticket.url}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline underline-offset-2"
          >
            #{ticket.issue}
          </a>
        ) : (
          <span className="font-semibold">#{ticket.issue}</span>
        )}
        {ticket.workflow && (
          <span
            className="text-xs text-muted"
            data-testid="factory-banner-workflow"
          >
            {ticket.workflow.name} · v{ticket.workflow.version}
          </span>
        )}
        <RunStateChip state={ticket.state} testId="factory-banner-state" />
        <span className="min-w-0 truncate text-xs text-foreground">
          {ticket.stateLabel}
        </span>
        {ticket.pr && (
          <a
            href={ticket.pr.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline underline-offset-2"
          >
            PR #{ticket.pr.number}
            {ticket.pr.draft ? " (brouillon)" : ""}
          </a>
        )}
        <span className="ml-auto flex items-center gap-2 text-xs">
          {ticket.workflow && (
            <button
              type="button"
              className="cursor-pointer text-muted hover:text-foreground"
              onClick={() => setShowGraph((v) => !v)}
              data-testid="factory-banner-graph-toggle"
            >
              {showGraph ? "Masquer le graphe" : "Voir le graphe"}
            </button>
          )}
          {editLink && (
            <Link
              to={editLink}
              className="text-muted hover:text-foreground"
              data-testid="factory-banner-edit"
            >
              Modifier le workflow
            </Link>
          )}
        </span>
      </div>
      {ticket.steps.length > 0 && (
        <ol className="flex flex-wrap gap-1" data-testid="factory-banner-steps">
          {ticket.steps.map((s) => (
            <li
              key={s.key}
              className={cn(
                "rounded-full border px-2 text-2xs leading-5",
                STEP_TONE[s.status],
              )}
            >
              {s.status === "done" ? "✓ " : ""}
              {s.label}
            </li>
          ))}
        </ol>
      )}
      {ticket.review && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-feedback-warning">
            👀 Décision attendue sur {ticket.review.what}
          </span>
          <button
            type="button"
            className="cursor-pointer rounded bg-contrast px-3 py-0.5 text-xs font-semibold text-contrast-foreground hover:opacity-90"
            onClick={onDecide}
            data-testid="factory-banner-decide"
          >
            Décider
          </button>
        </div>
      )}
      {ticket.note && (
        <p className="whitespace-pre-wrap text-xs text-muted">{ticket.note}</p>
      )}
      {showGraph && ticket.workflow && (
        <WorkflowPreview
          workflowId={ticket.workflow.id}
          version={ticket.workflow.version}
          currentNode={ticket.node}
        />
      )}
    </div>
  );
}

export function FactoryConversationBanner() {
  const { data: ticket } = useFactoryTicket();
  const { selectTab, selectedTab, isRightPanelShown } =
    useSelectConversationTab();
  if (!ticket) return null;
  return (
    <FactoryBannerView
      ticket={ticket}
      onDecide={() => {
        if (!(selectedTab === "ticket" && isRightPanelShown))
          selectTab("ticket");
      }}
    />
  );
}
