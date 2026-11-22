/* eslint-disable i18next/no-literal-string -- factory UI is French-only */
import React from "react";
import toast from "react-hot-toast";
import { ChevronDown, Check } from "lucide-react";
import { useNavigation } from "#/context/navigation-context";
import { cn } from "#/utils/utils";
import {
  useCreateTicket,
  useProjects,
  useWorkflows,
  type FactoryProject,
  type WorkflowSummary,
} from "./workflows/api";

/** A factory task type: which project, which workflow. `null` = plain chat. */
export interface FactoryTaskChoice {
  projectId: string;
  workflowId: string;
}

export interface FactoryTaskOptions {
  project: FactoryProject;
  workflows: WorkflowSummary[];
}

/**
 * Task types offered when starting something new: the workflows enabled on each
 * active project (all non-archived ones when a project enabled none). Empty when the
 * factory API is unreachable (another backend, or no orchestrator): the picker hides.
 */
export function useFactoryTaskOptions(): FactoryTaskOptions[] {
  const { data: projects } = useProjects();
  const { data: workflows } = useWorkflows();
  return React.useMemo(() => {
    if (!projects || !workflows) return [];
    // Inactive projects are listed greyed out (nothing would run there).
    return [...projects]
      .sort((a, b) => Number(b.active) - Number(a.active))
      .map((project) => {
        const enabled = project.enabledWorkflows.length
          ? workflows.filter((w) => project.enabledWorkflows.includes(w.id))
          : workflows;
        // The project's default first.
        const sorted = [...enabled].sort(
          (a, b) =>
            Number(b.id === project.defaultWorkflow) -
            Number(a.id === project.defaultWorkflow),
        );
        return { project, workflows: sorted };
      })
      .filter((o) => o.workflows.length > 0);
  }, [projects, workflows]);
}

/** First line = issue title (shortened), the whole text = issue body. */
export function splitTask(message: string): { title: string; body: string } {
  const text = message.trim();
  const first = (text.split("\n")[0] ?? "").trim();
  const title =
    first.length > 120 ? `${first.slice(0, 117).trimEnd()}…` : first;
  return { title, body: text };
}

/**
 * Factory launch for a chat composer: with a task type chosen, the message becomes a
 * GitHub issue and the workflow starts on it (the orchestrator then opens the ticket's
 * conversation). Returns false when nothing was created, so the caller can restore
 * the text.
 */
export function useFactoryTaskLauncher() {
  const [choice, setChoice] = React.useState<FactoryTaskChoice | null>(null);
  const options = useFactoryTaskOptions();
  const { mutateAsync, isPending } = useCreateTicket();
  const { navigate } = useNavigation();

  // A choice whose workflow/project disappeared (archived, other backend) is dropped.
  const valid =
    choice &&
    options.some(
      (o) =>
        o.project.active &&
        o.project.id === choice.projectId &&
        o.workflows.some((w) => w.id === choice.workflowId),
    )
      ? choice
      : null;

  const launch = async (
    message: string,
    hasAttachments = false,
  ): Promise<boolean> => {
    if (!valid) return false;
    if (hasAttachments) {
      toast.error(
        "Les pièces jointes ne passent pas par la factory : mets un lien dans le texte.",
      );
      return false;
    }
    const { title, body } = splitTask(message);
    if (title.length < 3) {
      toast.error("La première ligne (titre de l'issue) est trop courte.");
      return false;
    }
    try {
      const r = await mutateAsync({ ...valid, title, body });
      toast.success(
        `Ticket #${r.issue} créé. La conversation s'ouvre dès que la factory le prend en charge.`,
      );
      navigate(`/tickets?run=${r.runId}`);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };

  return { choice: valid, setChoice, options, launch, isPending };
}

function choiceLabel(
  choice: FactoryTaskChoice | null,
  options: FactoryTaskOptions[],
): string {
  if (!choice) return "Chat libre";
  const o = options.find((x) => x.project.id === choice.projectId);
  const w = o?.workflows.find((x) => x.id === choice.workflowId);
  const name = w?.name ?? choice.workflowId;
  return options.length > 1 ? `${name} · ${choice.projectId}` : name;
}

/** "Type de tâche" dropdown: plain chat, or one of the factory workflows. */
export function FactoryTaskTypePicker({
  choice,
  options,
  onChange,
  disabled,
}: {
  choice: FactoryTaskChoice | null;
  options: FactoryTaskOptions[];
  onChange: (c: FactoryTaskChoice | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (options.length === 0) return null;
  const pick = (c: FactoryTaskChoice | null) => {
    onChange(c);
    setOpen(false);
  };
  const isSel = (p: string, w: string) =>
    choice?.projectId === p && choice.workflowId === w;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="factory-task-type"
        className={cn(
          "flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50",
          choice
            ? "border-contrast font-semibold text-foreground"
            : "border-border text-muted hover:text-foreground",
        )}
      >
        <span aria-hidden>🏭</span>
        {choiceLabel(choice, options)}
        <ChevronDown className="size-3" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          data-testid="factory-task-type-menu"
          className="absolute bottom-full left-0 z-50 mb-1 max-h-96 w-80 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-lg"
        >
          <TaskItem
            selected={!choice}
            title="Chat libre"
            description="Une conversation normale, sans ticket ni workflow."
            onClick={() => pick(null)}
          />
          {options.map((o) => (
            <div key={o.project.id}>
              <div className="px-2 pt-2 pb-1 text-3xs uppercase tracking-wide text-muted">
                Ticket factory · {o.project.repo}
                {!o.project.active && " (projet inactif)"}
              </div>
              {o.workflows.map((w) => (
                <TaskItem
                  key={w.id}
                  selected={isSel(o.project.id, w.id)}
                  title={
                    w.id === o.project.defaultWorkflow
                      ? `${w.name} (par défaut)`
                      : w.name
                  }
                  description={w.description}
                  disabled={!o.project.active}
                  onClick={() =>
                    pick({ projectId: o.project.id, workflowId: w.id })
                  }
                  testId={`factory-task-type-${o.project.id}-${w.id}`}
                />
              ))}
            </div>
          ))}
          <p className="px-2 pt-2 pb-1 text-3xs text-muted">
            Ticket factory : le message devient une issue GitHub (1re ligne =
            titre) et le workflow démarre dessus.
          </p>
        </div>
      )}
    </div>
  );
}

function TaskItem({
  selected,
  title,
  description,
  onClick,
  testId,
  disabled,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex w-full cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Check
        className={cn("mt-0.5 size-3 shrink-0", !selected && "invisible")}
        aria-hidden
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-foreground">{title}</span>
        {description && (
          <span className="line-clamp-2 text-3xs text-muted">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}
