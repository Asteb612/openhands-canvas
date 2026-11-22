/* eslint-disable i18next/no-literal-string -- factory UI is French-only */
import React from "react";
import { Link, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import { cn } from "#/utils/utils";
import { RunStateChip } from "../run-status";
import {
  useCreateTicket,
  useProjects,
  useRuns,
  useStartRun,
  type FactoryRun,
} from "../workflows/api";
import { splitTask, useFactoryTaskOptions } from "../task-type";

/** Board columns: what needs me first, then what moves, then the rest. */
export const COLUMNS: {
  id: string;
  title: string;
  hint: string;
  states: string[];
}[] = [
  {
    id: "human",
    title: "À valider",
    hint: "une décision t'attend",
    states: ["HUMAN"],
  },
  {
    id: "active",
    title: "En cours",
    hint: "l'agent travaille ou attend un évènement",
    states: ["ACTIVE", "WAITING"],
  },
  {
    id: "queued",
    title: "En file",
    hint: "pas encore pris en charge",
    states: ["QUEUED", "BLOCKED"],
  },
  {
    id: "failed",
    title: "Échec",
    hint: "à relancer ou abandonner",
    states: ["FAILED"],
  },
  {
    id: "done",
    title: "Terminés",
    hint: "terminés ou annulés",
    states: ["COMPLETED", "CANCELLED"],
  },
];

const DONE_SHOWN = 8;

export function since(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} j`;
}

/** Runs grouped by column, filtered by project and text. */
export function groupRuns(
  runs: FactoryRun[],
  filter: { project?: string; text?: string; workflow?: string },
) {
  const q = (filter.text ?? "").trim().toLowerCase();
  const kept = runs.filter(
    (r) =>
      (!filter.project || r.project === filter.project) &&
      (!filter.workflow || r.workflow === filter.workflow) &&
      (!q ||
        `#${r.issue} ${r.title} ${r.workflowName ?? r.workflow} ${r.nodeLabel ?? ""}`
          .toLowerCase()
          .includes(q)),
  );
  const out: Record<string, FactoryRun[]> = {};
  for (const c of COLUMNS)
    out[c.id] = kept
      .filter((r) => c.states.includes(r.state))
      // Oldest wait first where it matters; most recent first for history.
      .sort((a, b) => {
        const ka = a.nodeEnteredAt ?? a.updatedAt;
        const kb = b.nodeEnteredAt ?? b.updatedAt;
        return c.id === "done" ? kb.localeCompare(ka) : ka.localeCompare(kb);
      });
  return out;
}

function TicketCard({
  run,
  highlighted,
}: {
  run: FactoryRun;
  highlighted: boolean;
}) {
  const start = useStartRun();
  const [confirmRetry, setConfirmRetry] = React.useState(false);
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
  const editor = `/workflows?${new URLSearchParams({
    wf: run.workflow,
    ...(run.node ? { node: run.node } : {}),
  }).toString()}`;
  const retry = () => {
    if (!confirmRetry) {
      setConfirmRetry(true);
      return;
    }
    setConfirmRetry(false);
    start.mutate(
      { projectId: run.project, issue: run.issue, workflowId: run.workflow },
      {
        onSuccess: () => toast.success(`#${run.issue} relancé`),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <li
      ref={ref}
      data-testid={`ticket-card-${run.id}`}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border bg-surface p-2.5 text-xs",
        run.state === "HUMAN" ? "border-feedback-warning" : "border-border",
        highlighted && "ring-2 ring-contrast",
      )}
    >
      <div className="flex items-start gap-1.5">
        {issueUrl ? (
          <a
            href={issueUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            #{run.issue}
          </a>
        ) : (
          <span className="shrink-0 font-semibold">#{run.issue}</span>
        )}
        <span className="min-w-0 flex-1 text-foreground">{run.title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-muted">
        <RunStateChip state={run.state} />
        <span>{run.workflowName ?? run.workflow}</span>
        {run.nodeLabel && !["COMPLETED", "CANCELLED"].includes(run.state) && (
          <>
            <span aria-hidden>›</span>
            <span className="text-foreground">{run.nodeLabel}</span>
          </>
        )}
        <span className="ml-auto" title={run.nodeEnteredAt ?? run.updatedAt}>
          {since(run.nodeEnteredAt ?? run.updatedAt)}
        </span>
      </div>
      {run.state === "FAILED" && run.failureMessage && (
        <p className="line-clamp-3 text-status-error">{run.failureMessage}</p>
      )}
      {run.state === "QUEUED" && !run.conversationId && (
        <p className="text-muted">
          La conversation s’ouvrira à la prise en charge.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {run.conversationId && (
          <Link
            to={`/conversations/${run.conversationId}`}
            className={cn(
              run.state === "HUMAN"
                ? "rounded bg-contrast px-2 py-0.5 font-semibold text-contrast-foreground hover:opacity-90"
                : "underline underline-offset-2",
            )}
            data-testid={`ticket-open-${run.id}`}
          >
            {run.state === "HUMAN" ? "Décider" : "Conversation"}
          </Link>
        )}
        {prUrl && (
          <a
            href={prUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            PR #{run.prNumber}
          </a>
        )}
        <Link to={editor} className="text-muted hover:text-foreground">
          Workflow
        </Link>
        {run.state === "FAILED" && (
          <button
            type="button"
            onClick={retry}
            onBlur={() => setConfirmRetry(false)}
            disabled={start.isPending}
            className="ml-auto cursor-pointer text-muted hover:text-foreground"
            data-testid={`ticket-retry-${run.id}`}
          >
            {confirmRetry ? "Relancer ? Confirmer" : "Relancer"}
          </button>
        )}
      </div>
    </li>
  );
}

function NewTicketForm({ onDone }: { onDone: () => void }) {
  const options = useFactoryTaskOptions().filter((o) => o.project.active);
  const create = useCreateTicket();
  const [target, setTarget] = React.useState("");
  const [text, setText] = React.useState("");
  const value =
    target ||
    (options[0]
      ? `${options[0].project.id}/${options[0].workflows[0]!.id}`
      : "");
  if (options.length === 0)
    return (
      <p className="text-xs text-muted">
        Aucun projet actif : impossible de créer un ticket.
      </p>
    );
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const [projectId, workflowId] = value.split("/");
    const { title, body } = splitTask(text);
    if (title.length < 3) {
      toast.error("La première ligne (titre de l'issue) est trop courte.");
      return;
    }
    create.mutate(
      { projectId: projectId!, workflowId: workflowId!, title, body },
      {
        onSuccess: (r) => {
          toast.success(`Ticket #${r.issue} créé`);
          setText("");
          onDone();
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
      data-testid="new-ticket-form"
    >
      <label className="flex flex-col gap-1 text-xs text-muted">
        Type de tâche
        <select
          value={value}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded border border-border bg-base-secondary px-2 py-1 text-sm text-foreground"
        >
          {options.map((o) => (
            <optgroup key={o.project.id} label={o.project.repo}>
              {o.workflows.map((w) => (
                <option key={w.id} value={`${o.project.id}/${w.id}`}>
                  {w.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Description (1re ligne = titre de l’issue GitHub)
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="rounded border border-border bg-base-secondary px-2 py-1 text-sm text-foreground"
          data-testid="new-ticket-text"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="cursor-pointer px-3 py-1 text-xs text-muted hover:text-foreground"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={create.isPending}
          className="cursor-pointer rounded bg-contrast px-3 py-1 text-xs font-semibold text-contrast-foreground hover:opacity-90 disabled:opacity-50"
        >
          Créer l’issue et lancer
        </button>
      </div>
    </form>
  );
}

/** Factory tickets dashboard: every run of every project, by state. */
export default function TicketsPage() {
  const [params] = useSearchParams();
  const highlight = Number(params.get("run") ?? 0);
  const { data: runs, error, isLoading } = useRuns();
  const { data: projects } = useProjects();
  const [project, setProject] = React.useState("");
  const [workflow, setWorkflow] = React.useState("");
  const [text, setText] = React.useState("");
  const [showAllDone, setShowAllDone] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const groups = React.useMemo(
    () => groupRuns(runs ?? [], { project, text, workflow }),
    [runs, project, text, workflow],
  );
  const workflows = React.useMemo(
    () =>
      [
        ...new Map(
          (runs ?? []).map((r) => [r.workflow, r.workflowName ?? r.workflow]),
        ),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [runs],
  );

  return (
    <div
      className="flex h-full flex-col gap-3 overflow-y-auto p-4"
      data-testid="factory-tickets-page"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-semibold">Tickets</h1>
        {COLUMNS.slice(0, 4).map((c) => (
          <span
            key={c.id}
            className="rounded-full border border-border px-2 text-xs leading-6 text-muted"
            data-testid={`tickets-count-${c.id}`}
          >
            {c.title} <b className="text-foreground">{groups[c.id]!.length}</b>
          </span>
        ))}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Rechercher (#, titre, étape)"
            className="w-56 rounded border border-border bg-base-secondary px-2 py-1 text-xs"
            data-testid="tickets-search"
          />
          {projects && projects.length > 1 && (
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="rounded border border-border bg-base-secondary px-2 py-1 text-xs"
            >
              <option value="">Tous les projets</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.repo}
                </option>
              ))}
            </select>
          )}
          {workflows.length > 1 && (
            <select
              value={workflow}
              onChange={(e) => setWorkflow(e.target.value)}
              className="rounded border border-border bg-base-secondary px-2 py-1 text-xs"
              data-testid="tickets-workflow-filter"
            >
              <option value="">Tous les workflows</option>
              {workflows.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="cursor-pointer rounded bg-contrast px-3 py-1 text-xs font-semibold text-contrast-foreground hover:opacity-90"
            data-testid="tickets-new"
          >
            Nouveau ticket
          </button>
        </span>
      </div>
      {creating && (
        <div className="max-w-xl">
          <NewTicketForm onDone={() => setCreating(false)} />
        </div>
      )}
      {isLoading && <p className="text-sm text-muted">Chargement…</p>}
      {error && (
        <p className="text-sm text-status-error">
          API de la factory injoignable : {(error as Error).message}
        </p>
      )}
      {runs && (
        <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((c) => {
            const all = groups[c.id]!;
            const shown =
              c.id === "done" && !showAllDone ? all.slice(0, DONE_SHOWN) : all;
            return (
              <section
                key={c.id}
                className="flex min-w-0 flex-col gap-2"
                data-testid={`tickets-column-${c.id}`}
              >
                <header className="flex items-baseline gap-2">
                  <h2 className="text-sm font-semibold">{c.title}</h2>
                  <span className="text-xs text-muted">{all.length}</span>
                  <span className="truncate text-3xs text-muted">{c.hint}</span>
                </header>
                <ul className="flex flex-col gap-2">
                  {shown.map((r) => (
                    <TicketCard
                      key={r.id}
                      run={r}
                      highlighted={r.id === highlight}
                    />
                  ))}
                  {all.length === 0 && (
                    <li className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted">
                      Rien
                    </li>
                  )}
                </ul>
                {c.id === "done" && all.length > DONE_SHOWN && (
                  <button
                    type="button"
                    onClick={() => setShowAllDone((v) => !v)}
                    className="cursor-pointer text-xs text-muted hover:text-foreground"
                  >
                    {showAllDone
                      ? "Réduire"
                      : `Voir les ${all.length - DONE_SHOWN} autres`}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
