/**
 * Tickets: the runs of the active project (its own columns), or of every project
 * (`?scope=all`), by column. Deciding, retrying and creating happen here; a ticket's
 * conversation opens on its project's backend.
 */
import React from "react";
import { Link, useSearchParams } from "react-router";
import { Plus, Play, X } from "lucide-react";
import { cn } from "#/utils/utils";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import {
  reportFactoryError,
  useCreateTicket,
  useRuns,
  useStartRun,
  type FactoryRun,
} from "../api";
import { DecisionPanel } from "../decision-panel";
import { since } from "../format";
import { useFactoryT } from "../i18n";
import { conversationPath, useSelectedProject } from "../project-context";
import { RunStateChip } from "../run-status";
import { isTerminal } from "../states";
import { splitTask, useFactoryTaskOptions } from "../task-type";
import {
  Button,
  FactoryPage,
  Field,
  Notice,
  Pill,
  StateMessage,
  fieldClassName,
  selectClassName,
  textActionClassName,
  textareaClassName,
  useConfirm,
} from "../ui";
import { defaultColumns, groupRuns, isHistoryColumn } from "./columns";
import { FactoryStatusBar } from "./status-bar";

const HISTORY_SHOWN = 8;

function TicketCard({
  run,
  highlighted,
  showProject,
  onReview,
}: {
  run: FactoryRun;
  highlighted: boolean;
  showProject: boolean;
  onReview: (runId: number) => void;
}) {
  const t = useFactoryT();
  const start = useStartRun();
  const { ask, modal } = useConfirm();
  const ref = React.useRef<HTMLLIElement>(null);
  React.useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "center" });
  }, [highlighted]);
  const issueUrl = run.repo
    ? `https://github.com/${run.repo}/issues/${run.issue}`
    : null;
  const prUrl =
    run.repo && run.prNumber
      ? `https://github.com/${run.repo}/pull/${run.prNumber}`
      : null;
  const editor = `/factory/workflows?${new URLSearchParams({ wf: run.workflow, ...(run.node ? { node: run.node } : {}) }).toString()}`;
  const retry = () =>
    ask(
      t("retryConfirm", {
        issue: run.issue,
        wf: run.workflowName ?? run.workflow,
      }),
      () =>
        start.mutate(
          {
            projectId: run.project,
            issue: run.issue,
            workflowId: run.workflow,
          },
          {
            onSuccess: () =>
              displaySuccessToast(t("retried", { issue: run.issue })),
            onError: reportFactoryError,
          },
        ),
    );

  return (
    <li
      ref={ref}
      data-testid={`ticket-card-${run.id}`}
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-base-secondary p-3 text-sm",
        run.state === "HUMAN" ? "border-warning" : "border-border",
        highlighted && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start gap-1.5">
        {issueUrl ? (
          <a
            href={issueUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 font-medium text-content underline underline-offset-2"
          >
            #{run.issue}
          </a>
        ) : (
          <span className="shrink-0 font-medium text-content">
            #{run.issue}
          </span>
        )}
        <span className="min-w-0 flex-1 text-content">{run.title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-muted">
        <RunStateChip state={run.state} />
        {showProject && <Pill>{t("otherProject", { p: run.project })}</Pill>}
        <span>{run.workflowName ?? run.workflow}</span>
        {run.nodeLabel && !isTerminal(run.state) && (
          <>
            <span aria-hidden>›</span>
            <span className="text-content">{run.nodeLabel}</span>
          </>
        )}
        <span className="ml-auto" title={run.nodeEnteredAt ?? run.updatedAt}>
          {since(t, run.nodeEnteredAt ?? run.updatedAt)}
        </span>
      </div>
      {run.state === "FAILED" && run.failureMessage && (
        <p className="line-clamp-3 text-danger">{run.failureMessage}</p>
      )}
      {run.state === "QUEUED" && !run.conversationId && (
        <p className="text-muted">{t("opensWhenPicked")}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {run.state === "HUMAN" && (
          <Button
            type="button"
            variant="primary"
            onClick={() => onReview(run.id)}
            testId={`ticket-decide-${run.id}`}
          >
            {t("decide")}
          </Button>
        )}
        {run.conversationId && (
          <Link
            to={conversationPath(run.project, run.conversationId)}
            className={textActionClassName}
            data-testid={`ticket-open-${run.id}`}
          >
            {t("conversation")}
          </Link>
        )}
        {prUrl && (
          <a
            href={prUrl}
            target="_blank"
            rel="noreferrer"
            className={textActionClassName}
          >
            {t("prNumber", { n: run.prNumber! })}
          </a>
        )}
        <Link to={editor} className={textActionClassName}>
          {t("workflow")}
        </Link>
        {run.state === "FAILED" && (
          <button
            type="button"
            onClick={retry}
            disabled={start.isPending}
            className={cn(textActionClassName, "ml-auto")}
            data-testid={`ticket-retry-${run.id}`}
          >
            {t("retry")}
          </button>
        )}
      </div>
      {modal}
    </li>
  );
}

function NewTicketForm({ onDone }: { onDone: () => void }) {
  const t = useFactoryT();
  const options = useFactoryTaskOptions().filter(
    (o) => o.project.status === "ok",
  );
  const create = useCreateTicket();
  const [target, setTarget] = React.useState("");
  const [text, setText] = React.useState("");
  const value =
    target ||
    (options[0]
      ? `${options[0].project.id}/${options[0].workflows[0]!.id}`
      : "");
  if (options.length === 0)
    return <StateMessage kind="empty">{t("noActiveProject")}</StateMessage>;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const [projectId, workflowId] = value.split("/");
    const { title, body } = splitTask(text);
    if (title.length < 3) {
      reportFactoryError(t("titleTooShort"));
      return;
    }
    create.mutate(
      { projectId: projectId!, workflowId: workflowId!, title, body },
      {
        onSuccess: (r) => {
          displaySuccessToast(t("ticketCreated", { issue: r.issue }));
          setText("");
          onDone();
        },
        onError: reportFactoryError,
      },
    );
  };
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-base-secondary p-4"
      data-testid="new-ticket-form"
    >
      <Field label={t("taskType")}>
        <select
          value={value}
          onChange={(e) => setTarget(e.target.value)}
          className={selectClassName}
        >
          {options.map((o) => (
            <optgroup key={o.project.id} label={o.project.name}>
              {o.workflows.map((w) => (
                <option key={w.id} value={`${o.project.id}/${w.id}`}>
                  {w.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label={t("description")}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className={textareaClassName}
          data-testid="new-ticket-text"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit" variant="primary" isDisabled={create.isPending}>
          {t("createAndStart")}
        </Button>
      </div>
    </form>
  );
}

/** Manual start of an enabled workflow on an existing issue of the active project. */
function StartOnIssueForm({ onDone }: { onDone: () => void }) {
  const t = useFactoryT();
  const { project } = useSelectedProject();
  const start = useStartRun();
  const [issue, setIssue] = React.useState("");
  const [workflow, setWorkflow] = React.useState("");
  if (!project)
    return <StateMessage kind="empty">{t("chooseProject")}</StateMessage>;
  const wf =
    workflow || project.defaultWorkflow || project.enabledWorkflows[0] || "";
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-base-secondary p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start.mutate(
          { projectId: project.id, issue: Number(issue), workflowId: wf },
          {
            onSuccess: (r) => {
              displaySuccessToast(t("runCreated", { run: r.runId, issue }));
              onDone();
            },
            onError: reportFactoryError,
          },
        );
      }}
      data-testid="start-on-issue-form"
    >
      <Field label={t("issueNumber")} className="w-32">
        <input
          className={fieldClassName}
          inputMode="numeric"
          value={issue}
          onChange={(e) => setIssue(e.target.value.replace(/\D/g, ""))}
        />
      </Field>
      <Field label={t("workflow")} className="min-w-48 flex-1">
        <select
          className={selectClassName}
          value={wf}
          onChange={(e) => setWorkflow(e.target.value)}
        >
          {project.enabledWorkflows.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </Field>
      <Button type="button" variant="secondary" onClick={onDone}>
        {t("cancel")}
      </Button>
      <Button
        type="submit"
        variant="primary"
        isDisabled={!issue || !wf || start.isPending}
      >
        {t("start")}
      </Button>
    </form>
  );
}

export default function TicketsPage() {
  const t = useFactoryT();
  const [params, setParams] = useSearchParams();
  const highlight = Number(params.get("run") ?? 0);
  const reviewId = Number(params.get("review") ?? 0) || null;
  const { projectId, project, projects } = useSelectedProject();
  // Every project when asked, or when no project is active.
  const allProjects = params.get("scope") === "all" || !projectId;
  const { data: runs, error, isLoading } = useRuns();
  const [workflow, setWorkflow] = React.useState("");
  const [text, setText] = React.useState("");
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [form, setForm] = React.useState<"new" | "start" | null>(null);

  const customColumns = !allProjects ? project?.settings?.columns : undefined;
  const board = React.useMemo(
    () =>
      groupRuns(
        runs ?? [],
        { project: allProjects ? undefined : projectId, text, workflow },
        customColumns?.length ? customColumns : defaultColumns(t),
        { title: t("colOther"), hint: t("colOtherHint") },
      ),
    [runs, allProjects, projectId, text, workflow, customColumns, t],
  );
  const visible = React.useMemo(
    () => (runs ?? []).filter((r) => allProjects || r.project === projectId),
    [runs, allProjects, projectId],
  );
  const needMe = visible.filter((r) => r.state === "HUMAN").length;
  const workflows = React.useMemo(
    () =>
      [
        ...new Map(
          visible.map((r) => [r.workflow, r.workflowName ?? r.workflow]),
        ),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [visible],
  );
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  return (
    <FactoryPage
      title={t("ticketsTitle")}
      testId="factory-tickets-page"
      badge={
        <Pill tone={needMe ? "warning" : "neutral"} testId="tickets-need-me">
          {t("decisionsWaiting", { n: needMe })}
        </Pill>
      }
      actions={
        <>
          {projectId && (
            <select
              className={cn(selectClassName, "w-auto")}
              value={allProjects ? "all" : "project"}
              onChange={(e) =>
                setParam("scope", e.target.value === "all" ? "all" : null)
              }
              data-testid="tickets-scope"
            >
              <option value="project">{project?.name ?? projectId}</option>
              <option value="all">{t("allProjects")}</option>
            </select>
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("search")}
            className={cn(fieldClassName, "w-56")}
            data-testid="tickets-search"
          />
          {workflows.length > 1 && (
            <select
              value={workflow}
              onChange={(e) => setWorkflow(e.target.value)}
              className={cn(selectClassName, "w-auto")}
              data-testid="tickets-workflow-filter"
            >
              <option value="">{t("allWorkflows")}</option>
              {workflows.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setForm((f) => (f === "start" ? null : "start"))}
            testId="tickets-start"
            startContent={<Play className="size-4" aria-hidden />}
          >
            {t("startOnIssue")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => setForm((f) => (f === "new" ? null : "new"))}
            testId="tickets-new"
            startContent={<Plus className="size-4" aria-hidden />}
          >
            {t("newTicket")}
          </Button>
        </>
      }
    >
      <FactoryStatusBar />
      {!projectId && projects.length > 0 && (
        <Notice tone="info" testId="tickets-no-project">
          {t("notProjectBackend")}
        </Notice>
      )}
      {form === "new" && (
        <div className="max-w-xl">
          <NewTicketForm onDone={() => setForm(null)} />
        </div>
      )}
      {form === "start" && <StartOnIssueForm onDone={() => setForm(null)} />}
      {!allProjects && customColumns?.length ? (
        <p className="text-sm text-muted">
          {t("projectColumns")} ·{" "}
          <Link to="/factory/project" className={textActionClassName}>
            {t("configure")}
          </Link>
        </p>
      ) : null}
      {isLoading && <StateMessage kind="loading" />}
      {error && (
        <StateMessage kind="error">
          {t("apiUnreachable", { msg: (error as Error).message })}
        </StateMessage>
      )}
      {runs && (
        <div
          className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none"
          data-testid="tickets-board"
        >
          {board.columns.map((c) => {
            const all = board.groups[c.id]!;
            const history = isHistoryColumn(c);
            const shown =
              history && !expanded[c.id] ? all.slice(0, HISTORY_SHOWN) : all;
            return (
              <section
                key={c.id}
                className="flex min-w-0 flex-col gap-2"
                data-testid={`tickets-column-${c.id}`}
              >
                <header className="flex items-baseline gap-2">
                  <h2 className="text-sm font-medium text-content">
                    {c.title}
                  </h2>
                  <span
                    className="text-sm text-muted"
                    data-testid={`tickets-count-${c.id}`}
                  >
                    {all.length}
                  </span>
                  {c.hint && (
                    <span className="truncate text-xs text-muted">
                      {c.hint}
                    </span>
                  )}
                </header>
                <ul className="flex flex-col gap-2">
                  {shown.map((r) => (
                    <TicketCard
                      key={r.id}
                      run={r}
                      highlighted={r.id === highlight}
                      showProject={allProjects}
                      onReview={(id) => setParam("review", String(id))}
                    />
                  ))}
                  {all.length === 0 && (
                    <li>
                      <StateMessage kind="empty">{t("none")}</StateMessage>
                    </li>
                  )}
                </ul>
                {history && all.length > HISTORY_SHOWN && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((v) => ({ ...v, [c.id]: !v[c.id] }))
                    }
                    className={textActionClassName}
                  >
                    {expanded[c.id]
                      ? t("showLess")
                      : t("showMore", { n: all.length - HISTORY_SHOWN })}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
      {reviewId && (
        <ModalBackdrop
          onClose={() => setParam("review", null)}
          aria-label={t("decisionTitle")}
        >
          <div
            className="flex max-h-[85vh] w-[min(56rem,92vw)] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-base-secondary p-4"
            data-testid="review-panel"
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setParam("review", null)}
                aria-label={t("cancel")}
                className="cursor-pointer text-muted hover:text-content"
              >
                <X className="size-4" />
              </button>
            </div>
            <DecisionPanel
              runId={reviewId}
              onDecided={() => setParam("review", null)}
            />
          </div>
        </ModalBackdrop>
      )}
    </FactoryPage>
  );
}
