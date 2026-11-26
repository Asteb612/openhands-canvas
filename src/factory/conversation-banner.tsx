/** Workflow status on top of a factory ticket conversation. */
import React from "react";
import { Link } from "react-router";
import { ChevronDown, Eye, Network, Pencil } from "lucide-react";
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
  const q = new URLSearchParams();
  if (ticket.node) q.set("node", ticket.node);
  const qs = q.toString();
  return `/factory/workflows/${encodeURIComponent(ticket.workflow.id)}/edit${qs ? `?${qs}` : ""}`;
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
  // Mobile: one compact line by default, the rest behind a toggle (always shown from md).
  const [expanded, setExpanded] = React.useState(false);
  const details = expanded ? "flex" : "hidden md:flex";
  const editLink = workflowEditorLink(ticket);
  return (
    <div
      className={cn(
        "mx-2 mb-2 flex flex-col gap-1.5 rounded-xl border bg-base-secondary px-2.5 py-1.5 md:gap-2 md:px-3 md:py-2",
        ticket.review ? "border-warning" : "border-border",
      )}
      data-testid="factory-banner"
    >
      <div className="flex items-center gap-x-2 gap-y-1 text-sm md:flex-wrap">
        {ticket.url ? (
          <a
            href={ticket.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 font-medium text-content underline underline-offset-2"
          >
            #{ticket.issue}
          </a>
        ) : (
          <span className="min-w-0 truncate font-medium text-content md:whitespace-normal">
            {ticket.issue === null ? ticket.title : `#${ticket.issue}`}
          </span>
        )}
        {ticket.workflow && (
          <span
            className="hidden text-muted md:inline"
            data-testid="factory-banner-workflow"
          >
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
            className="hidden shrink-0 underline underline-offset-2 md:inline"
          >
            {t("prNumber", { n: ticket.pr.number })}
            {ticket.pr.draft ? ` ${t("draft")}` : ""}
          </a>
        )}
        {ticket.review && (
          <Button
            type="button"
            variant="primary"
            onClick={onDecide}
            testId="factory-banner-decide-compact"
            className="ml-auto h-7 shrink-0 px-3 text-xs md:hidden"
          >
            {t("decide")}
          </Button>
        )}
        <button
          type="button"
          className={cn(
            textActionClassName,
            "shrink-0 md:hidden",
            !ticket.review && "ml-auto",
          )}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? t("bannerLess") : t("bannerMore")}
          data-testid="factory-banner-expand"
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        <span className="ml-auto hidden items-center gap-3 md:flex">
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
      {expanded && (
        <div className="flex flex-col gap-1 text-sm md:hidden">
          {ticket.workflow && (
            <span className="text-muted">
              {t("workflowVersion", {
                name: ticket.workflow.name,
                version: ticket.workflow.version,
              })}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-3">
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
            {ticket.workflow && project && (
              <button
                type="button"
                className={cn(
                  textActionClassName,
                  "inline-flex items-center gap-1",
                )}
                onClick={() => setShowGraph((v) => !v)}
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
              >
                <Pencil className="size-3.5" aria-hidden />
                {t("editWorkflow")}
              </Link>
            )}
          </span>
        </div>
      )}
      <div className={details}>
        <TicketSteps steps={ticket.steps} testId="factory-banner-steps" />
      </div>
      {ticket.review && (
        <div className="hidden flex-wrap items-center gap-2 text-sm md:flex">
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
        <p
          className={cn(
            "whitespace-pre-wrap text-sm text-muted",
            expanded ? "block" : "hidden md:block",
          )}
        >
          {ticket.note}
        </p>
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
