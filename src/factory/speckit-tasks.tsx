/**
 * Spec Kit tasks (`specs/tasks.md` of a factory ticket workspace) in the Planner
 * tab: progress, then each phase with its tasks (checked, id, [P], story).
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, ChevronDown, ChevronRight, Square } from "lucide-react";
import AgentServerConversationService from "#/api/conversation-service/agent-server-conversation-service.api";
import { cn } from "#/utils/utils";
import { useFactoryT } from "./i18n";

export const SPECKIT_TASKS_RELATIVE_PATH = "specs/tasks.md";
const POLL_MS = 15_000;

export interface SpeckitTask {
  id: string | null;
  done: boolean;
  parallel: boolean;
  story: string | null;
  text: string;
}

export interface SpeckitGroup {
  title: string;
  /** "###" sub-sections of a phase. */
  sub: boolean;
  tasks: SpeckitTask[];
}

export interface SpeckitPhase {
  title: string;
  groups: SpeckitGroup[];
  done: number;
  total: number;
}

const TASK_RE = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;

export function parseSpeckitTasks(md: string): {
  phases: SpeckitPhase[];
  done: number;
  total: number;
} {
  const phases: SpeckitPhase[] = [];
  let phase: SpeckitPhase | null = null;
  let group: SpeckitGroup | null = null;
  for (const line of md.split(/\r?\n/)) {
    const h = /^(##|###)\s+(.*)$/.exec(line);
    if (h) {
      if (h[1] === "##") {
        phase = { title: h[2].trim(), groups: [], done: 0, total: 0 };
        phases.push(phase);
        group = null;
      } else if (phase) {
        group = { title: h[2].trim(), sub: true, tasks: [] };
        phase.groups.push(group);
      }
    } else {
      const m = TASK_RE.exec(line);
      if (m && phase) {
        let rest = m[2].trim();
        const id = /^(T\d+)\b\s*/.exec(rest);
        if (id) rest = rest.slice(id[0].length);
        const parallel = /^\[P\]\s*/.test(rest);
        if (parallel) rest = rest.replace(/^\[P\]\s*/, "");
        const story = /^\[(US\d+)\]\s*/.exec(rest);
        if (story) rest = rest.slice(story[0].length);
        if (!group) {
          group = { title: "", sub: false, tasks: [] };
          phase.groups.push(group);
        }
        const done = m[1] !== " ";
        group.tasks.push({
          id: id?.[1] ?? null,
          done,
          parallel,
          story: story?.[1] ?? null,
          text: rest,
        });
        phase.total += 1;
        if (done) phase.done += 1;
      }
    }
  }
  const withTasks = phases
    .filter((p) => p.total > 0)
    .map((p) => ({ ...p, groups: p.groups.filter((g) => g.tasks.length) }));
  return {
    phases: withTasks,
    done: withTasks.reduce((n, p) => n + p.done, 0),
    total: withTasks.reduce((n, p) => n + p.total, 0),
  };
}

/** `code` spans of a task line, the rest as text. */
function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i} className="rounded bg-surface-raised px-1 text-xs">
            {p.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

export function useSpeckitTasks(
  conversationId: string | undefined,
  workingDir: string | null | undefined,
) {
  return useQuery({
    queryKey: ["factory", "speckit-tasks", conversationId, workingDir],
    enabled: !!conversationId && !!workingDir,
    refetchInterval: POLL_MS,
    retry: false,
    meta: { disableToast: true },
    queryFn: async () => {
      try {
        const raw = await AgentServerConversationService.readConversationFile(
          conversationId!,
          `${workingDir}/${SPECKIT_TASKS_RELATIVE_PATH}`,
        );
        const parsed = parseSpeckitTasks(raw);
        return parsed.total > 0 ? parsed : null;
      } catch {
        return null; // no tasks.md: not a Spec Kit workspace (yet)
      }
    },
  });
}

function PhaseBlock({ phase }: { phase: SpeckitPhase }) {
  const t = useFactoryT();
  const complete = phase.done === phase.total;
  const [open, setOpen] = React.useState(!complete);
  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 py-1.5 text-left text-sm font-medium text-content hover:cursor-pointer"
        data-testid="speckit-phase"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">{phase.title}</span>
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            complete ? "text-success" : "text-muted",
          )}
        >
          {phase.done}/{phase.total}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 pb-2 pl-6">
          {phase.groups.map((g) => (
            <div
              key={`${g.title}-${g.tasks[0]?.id}`}
              className="flex flex-col gap-1"
            >
              {g.sub && (
                <p className="text-xs font-medium text-muted">{g.title}</p>
              )}
              <ul className="flex flex-col gap-1">
                {g.tasks.map((task, i) => (
                  <li
                    key={`${task.id ?? ""}-${i}`}
                    className={cn(
                      "flex gap-2 text-sm",
                      task.done ? "text-muted" : "text-content",
                    )}
                    data-testid="speckit-task"
                  >
                    {task.done ? (
                      <CheckSquare
                        className="mt-0.5 size-4 shrink-0 text-success"
                        aria-label={t("speckitDone")}
                      />
                    ) : (
                      <Square
                        className="mt-0.5 size-4 shrink-0"
                        aria-label={t("speckitTodo")}
                      />
                    )}
                    <span className="min-w-0 break-words">
                      {task.id && (
                        <span className="mr-1 font-mono text-xs text-muted">
                          {task.id}
                        </span>
                      )}
                      {task.parallel && (
                        <span className="mr-1 rounded border border-border px-1 text-xs text-muted">
                          P
                        </span>
                      )}
                      {task.story && (
                        <span className="mr-1 rounded border border-border px-1 text-xs text-muted">
                          {task.story}
                        </span>
                      )}
                      <InlineCode text={task.text} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

export function SpeckitTasksPanel({
  tasks,
}: {
  tasks: ReturnType<typeof parseSpeckitTasks>;
}) {
  const t = useFactoryT();
  const pct = Math.round((tasks.done / tasks.total) * 100);
  return (
    <section
      className="flex flex-col gap-2 rounded-xl border border-border bg-base-secondary p-3"
      data-testid="speckit-tasks"
    >
      <header className="flex items-center gap-2 text-sm">
        <h2 className="font-semibold text-content">{t("speckitTasks")}</h2>
        <span className="ml-auto tabular-nums text-muted">
          {t("speckitProgress", { done: tasks.done, total: tasks.total })}
        </span>
      </header>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-success transition-all"
          // eslint-disable-next-line shadcn/no-inline-styles
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="flex flex-col">
        {tasks.phases.map((p) => (
          <PhaseBlock key={p.title} phase={p} />
        ))}
      </ul>
    </section>
  );
}
