import React from "react";
import { ChevronDown, Check, Workflow as WorkflowIcon } from "lucide-react";
import {
  formControlBorderClassName,
  formControlSurfaceClassName,
  formControlTransitionClassName,
} from "#/utils/form-control-classes";
import { dropdownMenuRowClassName } from "#/utils/dropdown-classes";
import { NEW_CONVERSATION_DROPDOWN_SURFACE } from "#/components/features/conversation-panel/new-conversation-dropdown-styles";
import { useNavigation } from "#/context/navigation-context";
import { cn } from "#/utils/utils";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import {
  reportFactoryError,
  useCreateTicket,
  useWorkflows,
  type FactoryProject,
  type WorkflowSummary,
} from "./api";
import { useFactoryT } from "./i18n";
import { useSelectedProject } from "./project-context";

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
 * Task types offered when starting something new: the active project's enabled
 * workflows (its own copies), default first. Empty without an active project or
 * without the factory API (the picker hides).
 */
export function useFactoryTaskOptions(): FactoryTaskOptions[] {
  const { project } = useSelectedProject();
  const { data: workflows } = useWorkflows(
    project ? { kind: "project", project: project.id } : null,
  );
  return React.useMemo(() => {
    if (!project || !workflows) return [];
    const enabled = workflows.filter((w) =>
      project.enabledWorkflows.includes(w.id),
    );
    const sorted = [...enabled].sort(
      (a, b) =>
        Number(b.id === project.defaultWorkflow) -
        Number(a.id === project.defaultWorkflow),
    );
    return sorted.length ? [{ project, workflows: sorted }] : [];
  }, [project, workflows]);
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
  const t = useFactoryT();

  // A choice whose workflow/project disappeared (archived, other backend) is dropped.
  const valid =
    choice &&
    options.some(
      (o) =>
        o.project.status === "ok" &&
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
      reportFactoryError(t("noAttachments"));
      return false;
    }
    const { title, body } = splitTask(message);
    if (title.length < 3) {
      reportFactoryError(t("titleTooShort"));
      return false;
    }
    try {
      const r = await mutateAsync({ ...valid, title, body });
      displaySuccessToast(t("ticketCreated", { issue: r.issue }));
      navigate(`/factory/tickets?run=${r.runId}`);
      return true;
    } catch (e) {
      reportFactoryError(e);
      return false;
    }
  };

  return { choice: valid, setChoice, options, launch, isPending };
}

function choiceLabel(
  t: ReturnType<typeof useFactoryT>,
  choice: FactoryTaskChoice | null,
  options: FactoryTaskOptions[],
): string {
  if (!choice) return t("freeChat");
  const o = options.find((x) => x.project.id === choice.projectId);
  return (
    o?.workflows.find((x) => x.id === choice.workflowId)?.name ??
    choice.workflowId
  );
}

/** Composer chip (same look as the plugin picker): plain chat, or a workflow of the active project. */
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
  const t = useFactoryT();
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
          "flex flex-row items-center gap-2 rounded-full px-2.5 py-1 text-sm",
          formControlBorderClassName,
          formControlSurfaceClassName,
          formControlTransitionClassName,
          choice ? "text-content" : "text-contrast",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:bg-surface-raised",
        )}
      >
        <WorkflowIcon className="size-4 shrink-0" aria-hidden />
        {choiceLabel(t, choice, options)}
        <ChevronDown className="size-3" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          data-testid="factory-task-type-menu"
          className={cn(
            NEW_CONVERSATION_DROPDOWN_SURFACE,
            "absolute bottom-full left-0 mb-1 max-h-96 w-80 overflow-y-auto",
          )}
        >
          <TaskItem
            selected={!choice}
            title={t("freeChat")}
            description={t("freeChatHint")}
            onClick={() => pick(null)}
          />
          {options.map((o) => (
            <div key={o.project.id}>
              <div className="px-2 pt-2 pb-1 text-xs text-muted">
                {t("factoryTicketOf", {
                  repo: o.project.repo ?? o.project.name,
                })}
              </div>
              {o.workflows.map((w) => (
                <TaskItem
                  key={w.id}
                  selected={isSel(o.project.id, w.id)}
                  title={
                    w.id === o.project.defaultWorkflow
                      ? t("byDefault", { name: w.name })
                      : w.name
                  }
                  description={w.description}
                  disabled={o.project.status !== "ok"}
                  onClick={() =>
                    pick({ projectId: o.project.id, workflowId: w.id })
                  }
                  testId={`factory-task-type-${o.project.id}-${w.id}`}
                />
              ))}
            </div>
          ))}
          <p className="px-2 pt-2 pb-1 text-xs text-muted">
            {t("factoryTicketHint")}
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
      className={cn(dropdownMenuRowClassName, "items-start")}
    >
      <Check
        className={cn("mt-0.5 size-3.5 shrink-0", !selected && "invisible")}
        aria-hidden
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm text-content">{title}</span>
        {description && (
          <span className="line-clamp-2 text-xs text-muted">{description}</span>
        )}
      </span>
    </button>
  );
}
