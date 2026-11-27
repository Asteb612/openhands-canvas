/** Ticket tab of a factory ticket conversation: state, steps, decision, workflow graph. */
import { Link } from "react-router";
import { openWorkspaceFile } from "#/services/canvas-ui";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { DecisionPanel } from "./decision-panel";
import { FactoryDemoGallery } from "./demo-gallery";
import { useFactoryPreview } from "./preview-panel";
import { useFactoryLocale, useFactoryT } from "./i18n";
import { RunStateChip, useConversationRun } from "./run-status";
import { useFactoryTicket, type FactoryTicket } from "./ticket";
import { TicketSteps } from "./ticket-steps";
import { workflowEditorLink } from "./conversation-banner";
import { WorkflowPreview } from "./workflows/workflow-preview";
import { useResume } from "./resume-run";
import type { FactoryRun } from "./api";
import { Button, Notice, StateMessage, textActionClassName } from "./ui";

/** A failed run of this conversation: resume it at a step (nothing before is redone). */
function ResumeAction({ run }: { run: FactoryRun }) {
  const t = useFactoryT();
  const resume = useResume(run);
  if (!resume.canResume) return null;
  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        onClick={resume.open}
        isDisabled={resume.resuming}
        testId="factory-resume"
      >
        {t("resumeRun")}
      </Button>
      {resume.modal}
    </div>
  );
}

/** The project's stack preview, opened in a real browser tab (manual tests). */
function PreviewLink() {
  const t = useFactoryT();
  const preview = useFactoryPreview();
  if (!preview) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <a
        href={preview.url}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
        data-testid="factory-preview-link"
      >
        {t("decisionPreview")} ↗
      </a>
      <a
        href={`${preview.url.replace(/\/$/, "")}/__factory/stacks`}
        target="_blank"
        rel="noreferrer"
        className="text-muted underline underline-offset-2"
        data-testid="factory-preview-stacks"
      >
        {t("previewStacks")}
      </a>
    </div>
  );
}

export function FactoryTicketView({
  ticket,
  runId,
  project,
}: {
  ticket: FactoryTicket;
  runId?: number;
  project?: string;
}) {
  const t = useFactoryT();
  const locale = useFactoryLocale();
  const edit = workflowEditorLink(ticket);
  return (
    <div className="flex flex-col gap-4 text-content">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-medium">
          {ticket.url ? (
            <a
              href={ticket.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              #{ticket.issue}
            </a>
          ) : ticket.issue === null ? null : (
            `#${ticket.issue}`
          )}{" "}
          {ticket.title}
        </h2>
        <p className="text-sm text-muted">
          {[ticket.repo, ticket.branch].filter(Boolean).join(" · ")}
        </p>
      </header>
      <div
        className="flex flex-wrap items-center gap-2 text-sm"
        data-testid="factory-state"
      >
        <RunStateChip state={ticket.state} />
        <span>{ticket.stateLabel}</span>
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
      </div>
      {ticket.note && (
        <p className="whitespace-pre-wrap rounded-lg bg-surface-raised p-2 text-sm">
          {ticket.note}
        </p>
      )}
      <TicketSteps steps={ticket.steps} />
      <PreviewLink />
      <FactoryDemoGallery />
      {ticket.review &&
        (runId !== undefined ? (
          <DecisionPanel
            runId={runId}
            onOpenFile={(f) => openWorkspaceFile(f)}
          />
        ) : (
          <Notice tone="warning">{t("decideInChat")}</Notice>
        ))}
      {ticket.workflow && project && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              {t("workflowVersion", {
                name: ticket.workflow.name,
                version: ticket.workflow.version,
              })}
            </span>
            {edit && (
              <Link
                to={edit}
                className={textActionClassName}
                data-testid="factory-edit-workflow"
              >
                {t("editWorkflow")}
              </Link>
            )}
          </div>
          <WorkflowPreview
            project={project}
            workflowId={ticket.workflow.id}
            version={ticket.workflow.version}
            currentNode={ticket.node}
            height={320}
          />
        </section>
      )}
      <p className="text-xs text-muted">
        {t("updatedAt", {
          at: new Date(ticket.updatedAt).toLocaleString(locale),
        })}
      </p>
    </div>
  );
}

export default function FactoryTicketTab() {
  const t = useFactoryT();
  const { conversationId } = useOptionalConversationId();
  const run = useConversationRun(conversationId ?? undefined);
  const { data: ticket, isLoading } = useFactoryTicket();
  if (isLoading)
    return (
      <div className="p-4">
        <StateMessage kind="loading" />
      </div>
    );
  if (!ticket)
    return <p className="p-4 text-sm text-muted">{t("notATicket")}</p>;
  return (
    <div className="h-full overflow-auto p-4">
      <FactoryTicketView
        ticket={ticket}
        runId={run?.state === "HUMAN" ? run.id : undefined}
        project={run?.project}
      />
      {(run?.state === "FAILED" || run?.state === "CANCELLED") && (
        <ResumeAction run={run} />
      )}
    </div>
  );
}
