/** Workflow status on top of a factory ticket conversation. */
import React from "react";
import { Link } from "react-router";
import { Eye, Network, Pencil } from "lucide-react";
import { cn } from "#/utils/utils";
import { useSelectConversationTab } from "#/hooks/use-select-conversation-tab";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useFactoryT } from "./i18n";
import { RunStateChip, useConversationRun } from "./run-status";
import { useFactoryTicket, type FactoryTicket } from "./ticket";
import { TicketSteps } from "./ticket-steps";
import { WorkflowPreview } from "./workflows/workflow-preview";
import { Button, textActionClassName } from "./ui";

/** Editor deep link on the ticket's workflow and current node. */
export function workflowEditorLink(
  ticket: Pick<FactoryTicket, "workflow" | "node">,
): string | null {
  if (!ticket.workflow) return null;
  const q = new URLSearchParams({ wf: ticket.workflow.id });
  if (ticket.node) q.set("node", ticket.node);
  return `/factory/workflows?${q.toString()}`;
}

export function FactoryBannerView({
  ticket,
  project,
  onDecide,
}: {
  ticket: FactoryTicket;
  project?: string;
  onDecide: () => void;
}) {
  const t = useFactoryT();
  const [showGraph, setShowGraph] = React.useState(false);
  const editLink = workflowEditorLink(ticket);
  return (
    <div
      className={cn(
        "mx-2 mb-2 flex flex-col gap-2 rounded-xl border bg-base-secondary px-3 py-2",
        ticket.review ? "border-warning" : "border-border",
      )}
      data-testid="factory-banner"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {ticket.url ? (
          <a
            href={ticket.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-content underline underline-offset-2"
          >
            #{ticket.issue}
          </a>
        ) : (
          <span className="font-medium text-content">#{ticket.issue}</span>
        )}
        {ticket.workflow && (
          <span className="text-muted" data-testid="factory-banner-workflow">
            {t("workflowVersion", {
              name: ticket.workflow.name,
              version: ticket.workflow.version,
            })}
          </span>
        )}
        <RunStateChip state={ticket.state} testId="factory-banner-state" />
        <span className="min-w-0 truncate text-content">
          {ticket.stateLabel}
        </span>
        {ticket.pr && (
          <a
            href={ticket.pr.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {t("prNumber", { n: ticket.pr.number })}
            {ticket.pr.draft ? ` ${t("draft")}` : ""}
          </a>
        )}
        <span className="ml-auto flex items-center gap-3">
          {ticket.workflow && project && (
            <button
              type="button"
              className={cn(
                textActionClassName,
                "inline-flex items-center gap-1",
              )}
              onClick={() => setShowGraph((v) => !v)}
              data-testid="factory-banner-graph-toggle"
            >
              <Network className="size-3.5" aria-hidden />
              {showGraph ? t("hideGraph") : t("showGraph")}
            </button>
          )}
          {editLink && (
            <Link
              to={editLink}
              className={cn(
                textActionClassName,
                "inline-flex items-center gap-1",
              )}
              data-testid="factory-banner-edit"
            >
              <Pencil className="size-3.5" aria-hidden />
              {t("editWorkflow")}
            </Link>
          )}
        </span>
      </div>
      <TicketSteps steps={ticket.steps} testId="factory-banner-steps" />
      {ticket.review && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 text-warning">
            <Eye className="size-4" aria-hidden />
            {t("decisionWaiting", { what: ticket.review.what })}
          </span>
          <Button
            type="button"
            variant="primary"
            onClick={onDecide}
            testId="factory-banner-decide"
          >
            {t("decide")}
          </Button>
        </div>
      )}
      {ticket.note && (
        <p className="whitespace-pre-wrap text-sm text-muted">{ticket.note}</p>
      )}
      {showGraph && ticket.workflow && project && (
        <WorkflowPreview
          project={project}
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
  const { conversationId } = useOptionalConversationId();
  const run = useConversationRun(conversationId ?? undefined);
  const { selectTab, selectedTab, isRightPanelShown } =
    useSelectConversationTab();
  if (!ticket) return null;
  return (
    <FactoryBannerView
      ticket={ticket}
      project={run?.project}
      onDecide={() => {
        if (!(selectedTab === "ticket" && isRightPanelShown))
          selectTab("ticket");
      }}
    />
  );
}
