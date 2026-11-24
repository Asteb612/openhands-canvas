/**
 * The active project's settings: state and pause, its own workflows (enabled, default),
 * board columns, notifications, and its versioned configuration (read-only: the
 * project file lives in the infra repo).
 */
import React from "react";
import { Link } from "react-router";
import { useQueries } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  PauseCircle,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { cn } from "#/utils/utils";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import {
  NOTIFY_KINDS,
  factoryFetch,
  factoryKeys,
  reportFactoryError,
  useFactoryStatus,
  useSaveProjectSettings,
  useSetProjectPause,
  useSetProjectWorkflows,
  useWorkflows,
  type BoardColumn,
  type CommandKind,
  type FactoryProject,
  type NotifyKind,
  type ProjectCommand,
  type ProjectSettings,
  type WorkflowDefinition,
} from "./api";
import { useFactoryLocale, useFactoryT, type FactoryKey } from "./i18n";
import {
  enableBrowserNotifications,
  notificationsSupported,
  useNotifyPref,
} from "./notifier";
import { useSelectedProject } from "./project-context";
import { RUN_STATES, stateLook } from "./states";
import { defaultColumns } from "./tickets/columns";
import {
  Button,
  FactoryShell,
  PageHeading,
  Field,
  Notice,
  Pill,
  Section,
  StateMessage,
  Switch,
  fieldClassName,
  selectClassName,
  textActionClassName,
  useConfirm,
} from "./ui";

export function slugify(title: string, taken: string[]): string {
  const base =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "colonne";
  let id = base;
  let i = 2;
  while (taken.includes(id)) id = `${base}-${i++}`;
  return id;
}

function settingsWith(
  project: FactoryProject,
  patch: Partial<ProjectSettings>,
): ProjectSettings {
  return {
    notify: project.settings?.notify ?? {
      events: ["human", "failed", "quota"],
    },
    ...(project.settings?.columns ? { columns: project.settings.columns } : {}),
    ...patch,
  };
}

function StateSection({ project }: { project: FactoryProject }) {
  const t = useFactoryT();
  const locale = useFactoryLocale();
  const pause = useSetProjectPause();
  const { ask, modal } = useConfirm();
  const set = (paused: boolean) =>
    pause.mutate(
      { projectId: project.id, paused },
      {
        onSuccess: () =>
          displaySuccessToast(paused ? t("pausedToast") : t("resumedToast")),
        onError: reportFactoryError,
      },
    );
  return (
    <>
      {project.status === "error" && (
        <Notice tone="danger">
          {t("projectError", { error: project.error ?? "" })}
        </Notice>
      )}
      {project.status === "inactive" && (
        <Notice tone="info">{t("projectInactive")}</Notice>
      )}
      {project.paused ? (
        <Notice tone="warning" testId="project-paused">
          <span className="flex-1">
            {t("projectPausedBy", {
              at: new Date(project.paused.at).toLocaleString(locale),
              by: project.paused.by,
            })}
          </span>
          <Button
            type="button"
            variant="primary"
            onClick={() => set(false)}
            isDisabled={pause.isPending}
            testId="project-resume"
            startContent={<PlayCircle className="size-4" aria-hidden />}
          >
            {t("resumeProject")}
          </Button>
        </Notice>
      ) : (
        project.status === "ok" && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              isDisabled={pause.isPending}
              onClick={() =>
                ask(
                  t("pauseProjectConfirm", { p: project.name }),
                  () => set(true),
                  { confirmText: t("pauseProject") },
                )
              }
              testId="project-pause"
              startContent={<PauseCircle className="size-4" aria-hidden />}
            >
              {t("pauseProject")}
            </Button>
          </div>
        )
      )}
      {modal}
    </>
  );
}

function WorkflowsSection({ project }: { project: FactoryProject }) {
  const t = useFactoryT();
  const { data: workflows, isLoading } = useWorkflows({
    kind: "project",
    project: project.id,
  });
  const setWf = useSetProjectWorkflows();
  const save = (def: string, enabled: string[]) =>
    setWf.mutate(
      { projectId: project.id, default: def, enabled },
      {
        onSuccess: () => displaySuccessToast(t("workflowsSaved")),
        onError: reportFactoryError,
      },
    );
  return (
    <Section
      title={t("workflowsSection")}
      description={t("workflowsSectionHint")}
      testId="project-workflows"
      actions={
        <Link to="/factory/workflows" className={textActionClassName}>
          {t("editWorkflow")}
        </Link>
      }
    >
      {isLoading && <StateMessage kind="loading" />}
      <table className="text-sm">
        <thead className="text-muted">
          <tr>
            <th className="w-20 py-1 text-left font-normal">{t("enabled")}</th>
            <th className="w-24 py-1 text-left font-normal">
              {t("defaultCol")}
            </th>
            <th className="py-1 text-left font-normal">{t("workflow")}</th>
          </tr>
        </thead>
        <tbody>
          {(workflows ?? []).map((w) => {
            const enabled = project.enabledWorkflows.includes(w.id);
            const isDefault = project.defaultWorkflow === w.id;
            return (
              <tr key={w.id} className="border-t border-border">
                <td className="py-1.5">
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={setWf.isPending || isDefault}
                    onChange={(e) =>
                      save(
                        project.defaultWorkflow ?? w.id,
                        e.target.checked
                          ? [...project.enabledWorkflows, w.id]
                          : project.enabledWorkflows.filter((x) => x !== w.id),
                      )
                    }
                    aria-label={`${t("enabled")} ${w.name}`}
                  />
                </td>
                <td className="py-1.5">
                  <input
                    type="radio"
                    name="default-workflow"
                    checked={isDefault}
                    disabled={!enabled || setWf.isPending}
                    onChange={() => save(w.id, project.enabledWorkflows)}
                    aria-label={`${t("defaultCol")} ${w.name}`}
                  />
                </td>
                <td className="py-1.5">
                  <Link
                    to={`/factory/workflows/${encodeURIComponent(w.id)}`}
                    className="text-content hover:underline"
                  >
                    {w.name}
                  </Link>{" "}
                  <span className="font-mono text-xs text-muted">{w.id}</span>
                  {w.source && (
                    <span className="ml-2 text-xs text-muted">
                      {t("fromTemplate", { t: w.source })}
                    </span>
                  )}
                  {w.templateUpdate && (
                    <Pill
                      tone="info"
                      title={t("templateUpdate", {
                        t: w.templateUpdate.templateId,
                        from: w.templateUpdate.from,
                        to: w.templateUpdate.to,
                      })}
                    >
                      {`v${w.templateUpdate.to}`}
                    </Pill>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

/** "workflow/node" choices from the latest version of each of the project's workflows. */
function useNodeChoices(project: string, workflowIds: string[]) {
  const results = useQueries({
    queries: workflowIds.map((id) => ({
      queryKey: factoryKeys.workflow({ kind: "project", project }, id),
      queryFn: () =>
        factoryFetch<{
          workflow: { name: string };
          definition: WorkflowDefinition;
        }>(
          `/projects/${encodeURIComponent(project)}/workflows/${encodeURIComponent(id)}`,
        ),
      refetchOnWindowFocus: false,
      meta: { disableToast: true },
    })),
  });
  // Cheap to rebuild: a handful of workflows and nodes.
  return results.flatMap((r, i) =>
    (r.data?.definition.nodes ?? [])
      .filter((n) => n.type !== "trigger")
      .map((n) => ({
        key: `${workflowIds[i]}/${n.id}`,
        label: `${r.data!.workflow.name} › ${n.label ?? n.id}`,
        nodeId: n.id,
      })),
  );
}

function ColumnEditor({
  value,
  onChange,
  nodeChoices,
}: {
  value: BoardColumn;
  onChange: (c: BoardColumn) => void;
  nodeChoices: { key: string; label: string; nodeId: string }[];
}) {
  const t = useFactoryT();
  const [pick, setPick] = React.useState("");
  const states = value.states ?? [];
  const nodes = value.nodes ?? [];
  const labelOf = (k: string) =>
    k.startsWith("*/")
      ? t("anyStepNamed", { id: k.slice(2) })
      : (nodeChoices.find((c) => c.key === k)?.label ?? k);
  // Same node id in several workflows: offer the "*/<id>" shortcut too.
  const shared = [...new Set(nodeChoices.map((c) => c.nodeId))].filter(
    (id) => nodeChoices.filter((c) => c.nodeId === id).length > 1,
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Field label={t("columnTitle")} className="w-48">
          <input
            className={fieldClassName}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            data-testid={`column-title-${value.id}`}
          />
        </Field>
        <Field label={t("columnHint")} className="min-w-48 flex-1">
          <input
            className={fieldClassName}
            value={value.hint ?? ""}
            onChange={(e) => onChange({ ...value, hint: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <span className="mr-1">{t("states")}</span>
        {RUN_STATES.map((s) => {
          const on = states.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  states: on ? states.filter((x) => x !== s) : [...states, s],
                })
              }
              className={cn(
                "cursor-pointer rounded-full border px-2 text-xs leading-6",
                on
                  ? "border-primary text-content"
                  : "border-border text-muted hover:text-content",
              )}
              aria-pressed={on}
              data-testid={`column-${value.id}-state-${s}`}
            >
              {t(stateLook(s).label)}
            </button>
          );
        })}
        {!states.length && <span className="text-xs">{t("any")}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <span className="mr-1">{t("steps")}</span>
        {nodes.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 text-xs leading-6 text-content"
          >
            {labelOf(k)}
            <button
              type="button"
              className="cursor-pointer text-muted hover:text-content"
              onClick={() =>
                onChange({ ...value, nodes: nodes.filter((x) => x !== k) })
              }
              aria-label={t("remove", { name: labelOf(k) })}
            >
              ×
            </button>
          </span>
        ))}
        {!nodes.length && <span className="text-xs">{t("anyStep")}</span>}
        <select
          className={cn(selectClassName, "h-8 min-h-8 w-auto text-xs")}
          value={pick}
          onChange={(e) => {
            const k = e.target.value;
            setPick("");
            if (k && !nodes.includes(k))
              onChange({ ...value, nodes: [...nodes, k] });
          }}
          data-testid={`column-${value.id}-add-node`}
        >
          <option value="">{t("addStep")}</option>
          {shared.map((id) => (
            <option key={`*/${id}`} value={`*/${id}`}>
              {t("anyStepNamed", { id })}
            </option>
          ))}
          {nodeChoices.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ColumnsSection({ project }: { project: FactoryProject }) {
  const t = useFactoryT();
  const save = useSaveProjectSettings();
  const saved = project.settings?.columns;
  const initial = React.useMemo(
    () => (saved?.length ? saved : defaultColumns(t)),
    [saved, t],
  );
  const [cols, setCols] = React.useState<BoardColumn[]>(initial);
  const [dirty, setDirty] = React.useState(false);
  React.useEffect(() => {
    setCols(initial);
    setDirty(false);
  }, [initial]);
  const nodeChoices = useNodeChoices(project.id, project.enabledWorkflows);
  const edit = (next: BoardColumn[]) => {
    setCols(next);
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...cols];
    const [c] = next.splice(i, 1);
    next.splice(i + d, 0, c!);
    edit(next);
  };
  const persist = (columns: BoardColumn[] | undefined) => {
    const { columns: _previous, ...rest } = settingsWith(project, {});
    save.mutate(
      {
        projectId: project.id,
        settings: columns ? { ...rest, columns } : rest,
      },
      {
        onSuccess: () => {
          displaySuccessToast(t("columnsSaved"));
          setDirty(false);
        },
        onError: reportFactoryError,
      },
    );
  };
  return (
    <Section
      title={t("columnsSection")}
      description={t("columnsHint")}
      testId="project-columns"
    >
      <ol className="flex flex-col gap-2">
        {cols.map((c, i) => (
          <li
            key={c.id}
            className="flex gap-3 rounded-lg border border-border p-3"
            data-testid={`column-row-${c.id}`}
          >
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="cursor-pointer text-muted hover:text-content disabled:opacity-30"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={t("moveUp")}
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                className="cursor-pointer text-muted hover:text-content disabled:opacity-30"
                disabled={i === cols.length - 1}
                onClick={() => move(i, 1)}
                aria-label={t("moveDown")}
              >
                <ArrowDown className="size-4" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <ColumnEditor
                value={c}
                nodeChoices={nodeChoices}
                onChange={(nc) =>
                  edit(cols.map((x) => (x.id === c.id ? nc : x)))
                }
              />
            </div>
            <button
              type="button"
              className="cursor-pointer self-start text-muted hover:text-danger"
              onClick={() => edit(cols.filter((x) => x.id !== c.id))}
              aria-label={t("remove", { name: c.title })}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          isDisabled={cols.length >= 12}
          onClick={() =>
            edit([
              ...cols,
              {
                id: slugify(
                  "nouvelle",
                  cols.map((c) => c.id),
                ),
                title: t("newColumn"),
                hint: "",
                states: [],
                nodes: [],
              },
            ])
          }
          testId="column-add"
        >
          {t("addColumn")}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          onClick={() => persist(undefined)}
          isDisabled={save.isPending || !saved?.length}
        >
          {t("defaultColumns")}
        </Button>
        <span className="flex-1" />
        <Button
          type="button"
          variant="primary"
          isDisabled={
            !dirty || save.isPending || cols.some((c) => !c.title.trim())
          }
          onClick={() => persist(cols)}
          testId="columns-save"
        >
          {t("saveColumns")}
        </Button>
      </div>
    </Section>
  );
}

function NotificationsSection({ project }: { project: FactoryProject }) {
  const t = useFactoryT();
  const save = useSaveProjectSettings();
  const { data: status } = useFactoryStatus();
  const events = project.settings?.notify.events ?? [
    "human",
    "failed",
    "quota",
  ];
  const notifyOn = useNotifyPref((s) => s.enabled);
  const setNotify = useNotifyPref((s) => s.setEnabled);
  const toggle = (k: NotifyKind) => {
    const next = events.includes(k)
      ? events.filter((x) => x !== k)
      : [...events, k];
    save.mutate(
      {
        projectId: project.id,
        settings: settingsWith(project, {
          notify: { ...project.settings?.notify, events: next },
        }),
      },
      { onError: reportFactoryError },
    );
  };
  const topicEnv = project.settings?.notify.topicEnv;
  return (
    <Section
      title={t("notificationsSection")}
      description={t("notificationsHint")}
      testId="project-notifications"
    >
      {notificationsSupported() && (
        <Switch
          testId="browser-notify"
          isToggled={notifyOn}
          onToggle={async (on) => {
            if (!on) setNotify(false);
            else if (!(await enableBrowserNotifications()))
              reportFactoryError(t("notifyDenied"));
          }}
        >
          {t("browserThisDevice")}
        </Switch>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-sm text-content">
          {t("pushEvents")} ·{" "}
          <span className="text-muted">
            {topicEnv
              ? t("pushTopic", { env: topicEnv })
              : t("pushGlobalTopic")}
          </span>
          {!status?.push && !topicEnv && (
            <span className="text-muted"> ({t("pushOff")})</span>
          )}
        </span>
        <div className="flex flex-wrap gap-4 text-sm">
          {NOTIFY_KINDS.map((k) => (
            <label key={k} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={events.includes(k)}
                disabled={save.isPending}
                onChange={() => toggle(k)}
                data-testid={`notify-${k}`}
              />
              {t(`notify${k}` as FactoryKey)}
            </label>
          ))}
        </div>
      </div>
    </Section>
  );
}

function ConfigSection({ project }: { project: FactoryProject }) {
  const t = useFactoryT();
  const { data: status } = useFactoryStatus();
  const sub = status?.subscriptions.find((s) => s.id === project.subscription);
  const c = project.config;
  const rows: [string, React.ReactNode][] = [
    [
      t("repo"),
      project.repo ? (
        <a
          href={`https://github.com/${project.repo}`}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          {project.repo}
        </a>
      ) : (
        "—"
      ),
    ],
    [t("subscription"), sub ? sub.label : (project.subscription ?? "—")],
  ];
  if (c) {
    rows.push([
      t("branch"),
      <span key="branch" className="font-mono">
        {c.defaultBranch}
      </span>,
    ]);
    rows.push([t("parallel"), String(c.concurrency)]);
    rows.push([t("githubProject"), c.githubProject ? t("tracked") : t("no")]);
  }
  return (
    <Section
      title={t("configSection")}
      description={t("configHint", { id: project.id })}
    >
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-muted">{k}</dt>
            <dd className="text-content">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
    </Section>
  );
}

const KIND_ORDER: CommandKind[] = ["setup", "check", "run", "other"];
const KIND_LABEL = {
  setup: "cmdKindSetup",
  check: "cmdKindCheck",
  run: "cmdKindRun",
  other: "cmdKindOther",
} as const;

/** The project's commands: what the agent reads in .factory/COMMANDS.md. */
function CommandsSection({ project }: { project: FactoryProject }) {
  const t = useFactoryT();
  const list: ProjectCommand[] =
    project.commandList ??
    project.commands.map((name) => ({
      name,
      run: "",
      description: "",
      kind: "other",
      timeoutSeconds: 0,
      unavailable: null,
    }));
  const copy = (text: string) =>
    navigator.clipboard
      ?.writeText(text)
      .then(() => displaySuccessToast(t("copied")))
      .catch(() => undefined);
  return (
    <Section
      title={t("commandsSection")}
      description={t("commandsHint", { id: project.id })}
      testId="factory-commands"
    >
      {project.docker !== undefined && (
        <div data-testid="factory-docker">
          <Pill tone={project.docker ? "success" : "warning"}>
            {t(project.docker ? "dockerOn" : "dockerOff")}
          </Pill>
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-sm text-muted">{t("noCommands")}</p>
      ) : (
        KIND_ORDER.map((kind) => {
          const group = list.filter((c) => c.kind === kind);
          if (!group.length) return null;
          return (
            <div key={kind} className="flex flex-col gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                {t(KIND_LABEL[kind])}
              </h3>
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {group.map((c) => (
                  <li
                    key={c.name}
                    className="flex flex-col gap-1 px-3 py-2.5"
                    data-testid={`factory-command-${c.name}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium text-content">
                        {c.name}
                      </span>
                      {c.unavailable ? (
                        <Pill tone="warning" title={c.unavailable}>
                          {t("cmdUnavailable")}
                        </Pill>
                      ) : (
                        c.timeoutSeconds > 0 && (
                          <Pill>
                            {t("cmdTimeout", {
                              m: Math.round(c.timeoutSeconds / 60),
                            })}
                          </Pill>
                        )
                      )}
                    </div>
                    {c.description && (
                      <p className="text-sm text-muted">{c.description}</p>
                    )}
                    {c.unavailable && (
                      <p className="text-xs text-warning">{c.unavailable}</p>
                    )}
                    {c.run && (
                      <div className="flex items-start gap-2">
                        <code className="min-w-0 flex-1 whitespace-pre-wrap break-all rounded-md bg-canvas-base px-2 py-1 font-mono text-xs text-content">
                          {c.run}
                        </code>
                        <button
                          type="button"
                          aria-label={t("copy")}
                          className="cursor-pointer pt-1 text-muted hover:text-content"
                          onClick={() => copy(c.run)}
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </Section>
  );
}

export default function FactoryProjectPage() {
  const t = useFactoryT();
  const { project } = useSelectedProject();
  return (
    <FactoryShell>
      <div className="flex flex-col gap-5" data-testid="factory-project-page">
        <PageHeading
          title={project ? project.name : t("projectTitle")}
          description={t("projectHint")}
          badge={
            project && (
              <span className="font-mono text-sm text-muted">{project.id}</span>
            )
          }
        />
        {!project ? (
          <StateMessage kind="empty">{t("chooseProject")}</StateMessage>
        ) : (
          <>
            <StateSection project={project} />
            <WorkflowsSection project={project} />
            <ColumnsSection key={project.id} project={project} />
            <NotificationsSection project={project} />
            <CommandsSection project={project} />
            <ConfigSection project={project} />
          </>
        )}
      </div>
    </FactoryShell>
  );
}
