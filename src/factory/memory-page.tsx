/**
 * Claude-Mem of the active project's agent: what it remembers (observations, search,
 * delete), whether it observes (quota), and that its observer stays on the Claude
 * subscription. Talks to the orchestrator, which reaches the worker in the agent pod.
 */
import React from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Database,
  Hourglass,
  MessagesSquare,
  ShieldCheck,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import { cn } from "#/utils/utils";
import {
  MEMORY_PAGE_SIZE,
  reportFactoryError,
  useDeleteObservation,
  useMemoryObservations,
  useMemoryOverview,
  useSaveMemorySettings,
  useSetMemoryPlugin,
  type MemObservation,
  type MemSettings,
} from "./api";
import { useFormatDateTime } from "./describe";
import { useFactoryT } from "./i18n";
import { useSelectedProject } from "./project-context";
import {
  ActivityList,
  ActivityRow,
  Button,
  FactoryShell,
  Field,
  Notice,
  OverviewTiles,
  PageHeading,
  Pill,
  Section,
  StateMessage,
  Switch,
  fieldClassName,
  selectClassName,
  textActionClassName,
  useConfirm,
} from "./ui";

const MB = 1024 * 1024;
/** Claude models the observer may use (the orchestrator refuses anything else). */
const OBSERVER_MODELS = ["haiku", "sonnet"];

function ObservationRow({
  o,
  onDelete,
  deleting,
}: {
  o: MemObservation;
  onDelete: () => void;
  deleting: boolean;
}) {
  const t = useFactoryT();
  const fmt = useFormatDateTime();
  const [open, setOpen] = React.useState(false);
  const files = [...o.filesModified, ...o.filesRead];
  return (
    <ActivityRow testId={`mem-obs-${o.id}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-start gap-2">
          <button
            type="button"
            className="flex min-w-0 cursor-pointer items-start gap-1 text-left"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted" />
            ) : (
              <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted" />
            )}
            {/* Two lines on phones, where the row is narrow; one line from sm up. */}
            <span className="line-clamp-2 break-words text-sm font-semibold text-content sm:truncate">
              {o.title || t("memUntitled")}
            </span>
          </button>
          {o.type && <Pill>{o.type}</Pill>}
        </div>
        <span className="truncate text-xs text-muted">
          #{o.id} · {o.project} · {o.createdAt ? fmt(o.createdAt) : ""}
          {o.subtitle ? ` · ${o.subtitle}` : ""}
        </span>
        {open && (
          <div
            className="mt-2 flex flex-col gap-2 text-sm text-text-secondary"
            data-testid={`mem-obs-${o.id}-details`}
          >
            {o.narrative && (
              <p className="whitespace-pre-wrap">{o.narrative}</p>
            )}
            {o.facts.length > 0 && (
              <ul className="list-disc pl-5">
                {o.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            {files.length > 0 && (
              <p className="break-all text-xs text-muted">
                {t("memFiles")} : {files.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className={textActionClassName}
        title={t("memDelete")}
        aria-label={t("memDelete")}
        disabled={deleting}
        data-testid={`mem-obs-${o.id}-delete`}
        onClick={onDelete}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </ActivityRow>
  );
}

function Observations({
  project,
  projects,
}: {
  project: string;
  projects: string[];
}) {
  const t = useFactoryT();
  const { ask, modal } = useConfirm();
  const [draft, setDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [memProject, setMemProject] = React.useState("");
  const [page, setPage] = React.useState(0);
  const list = useMemoryObservations(project, {
    project: memProject,
    query,
    page,
  });
  const del = useDeleteObservation(project);
  const items = list.data?.items ?? [];
  return (
    <Section
      title={t("memObservations")}
      description={t("memObservationsHint")}
      testId="mem-observations"
    >
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setQuery(draft.trim());
        }}
      >
        <input
          className={cn(fieldClassName, "w-auto min-w-48 flex-1")}
          value={draft}
          placeholder={t("memSearch")}
          aria-label={t("memSearch")}
          data-testid="mem-search"
          onChange={(e) => setDraft(e.target.value)}
        />
        <select
          className={cn(selectClassName, "w-auto shrink-0")}
          value={memProject}
          aria-label={t("memProjectFilter")}
          data-testid="mem-project"
          onChange={(e) => {
            setPage(0);
            setMemProject(e.target.value);
          }}
        >
          <option value="">{t("memAllProjects")}</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" testId="mem-search-go">
          {t("memSearchGo")}
        </Button>
      </form>
      {list.isLoading && <StateMessage kind="loading" />}
      {list.error && (
        <StateMessage kind="error">
          {(list.error as Error).message}
        </StateMessage>
      )}
      {list.data && items.length === 0 && (
        <StateMessage kind="empty">
          {query ? t("memNoResult") : t("memEmpty")}
        </StateMessage>
      )}
      {items.length > 0 && (
        <ActivityList testId="mem-list">
          {items.map((o) => (
            <ObservationRow
              key={o.id}
              o={o}
              deleting={del.isPending}
              onDelete={() =>
                ask(
                  t("memDeleteConfirm", { title: o.title || `#${o.id}` }),
                  () =>
                    del.mutate(o.id, {
                      onSuccess: () => displaySuccessToast(t("memDeleted")),
                      onError: reportFactoryError,
                    }),
                  { confirmText: t("memDelete") },
                )
              }
            />
          ))}
        </ActivityList>
      )}
      {!query && (page > 0 || list.data?.hasMore) && (
        <div className="flex items-center justify-between text-sm text-muted">
          <button
            type="button"
            className={textActionClassName}
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            {t("memPrev")}
          </button>
          <span>
            {t("memPage", {
              from: page * MEMORY_PAGE_SIZE + 1,
              to: page * MEMORY_PAGE_SIZE + items.length,
            })}
          </span>
          <button
            type="button"
            className={textActionClassName}
            disabled={!list.data?.hasMore}
            data-testid="mem-next"
            onClick={() => setPage(page + 1)}
          >
            {t("memNext")}
          </button>
        </div>
      )}
      {modal}
    </Section>
  );
}

function Settings({
  project,
  settings,
  plugin,
}: {
  project: string;
  settings: MemSettings | null;
  plugin: { installed: boolean; enabled: boolean };
}) {
  const t = useFactoryT();
  const { ask, modal } = useConfirm();
  const save = useSaveMemorySettings(project);
  const setPlugin = useSetMemoryPlugin(project);
  const [ctx, setCtx] = React.useState(
    String(settings?.contextObservations ?? ""),
  );
  React.useEffect(
    () => setCtx(String(settings?.contextObservations ?? "")),
    [settings?.contextObservations],
  );
  const patch = (p: Partial<MemSettings>) =>
    save.mutate(p, {
      onSuccess: () => displaySuccessToast(t("memSaved")),
      onError: reportFactoryError,
    });
  const togglePlugin = (on: boolean) =>
    setPlugin.mutate(on, {
      onSuccess: () => displaySuccessToast(t("memPluginChanged")),
      onError: reportFactoryError,
    });
  return (
    <Section title={t("memSettings")} testId="mem-settings">
      <Switch
        testId="mem-plugin"
        isToggled={plugin.enabled}
        isDisabled={!plugin.installed || setPlugin.isPending}
        onToggle={(on) =>
          on
            ? togglePlugin(true)
            : ask(t("memPluginOffConfirm"), () => togglePlugin(false), {
                confirmText: t("memPluginOff"),
              })
        }
      >
        {t("memPlugin")}
      </Switch>
      <p className="-mt-1 text-xs text-muted">
        {plugin.installed ? t("memPluginHint") : t("memPluginMissing")}
      </p>
      {settings && (
        <>
          <Switch
            testId="mem-observer"
            isToggled={settings.observerEnabled}
            isDisabled={save.isPending}
            onToggle={(observerEnabled) => patch({ observerEnabled })}
          >
            {t("memObserver")}
          </Switch>
          <p className="-mt-1 text-xs text-muted">{t("memObserverHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("memModel")} hint={t("memModelHint")}>
              <select
                className={selectClassName}
                value={settings.model}
                disabled={save.isPending}
                data-testid="mem-model"
                onChange={(e) => patch({ model: e.target.value })}
              >
                {OBSERVER_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("memContext")} hint={t("memContextHint")}>
              <input
                className={fieldClassName}
                type="number"
                min={0}
                max={500}
                value={ctx}
                data-testid="mem-context"
                onChange={(e) => setCtx(e.target.value)}
                onBlur={() => {
                  const n = Number(ctx);
                  if (
                    Number.isInteger(n) &&
                    n >= 0 &&
                    n <= 500 &&
                    n !== settings.contextObservations
                  )
                    patch({ contextObservations: n });
                }}
              />
            </Field>
          </div>
          <Switch
            testId="mem-skip-subagents"
            isToggled={settings.skipSubagentObservations}
            isDisabled={save.isPending}
            onToggle={(skipSubagentObservations) =>
              patch({ skipSubagentObservations })
            }
          >
            {t("memSkipSubagents")}
          </Switch>
          <Switch
            testId="mem-redact"
            isToggled={settings.redact}
            isDisabled={save.isPending}
            onToggle={(redact) => patch({ redact })}
          >
            {t("memRedact")}
          </Switch>
        </>
      )}
      {modal}
    </Section>
  );
}

export default function MemoryPage() {
  const t = useFactoryT();
  const fmt = useFormatDateTime();
  const { projectId, project } = useSelectedProject();
  const overview = useMemoryOverview(projectId);
  const o = overview.data;
  return (
    <FactoryShell>
      <PageHeading
        title={t("navMemory")}
        description={
          project ? t("memHint", { p: project.name }) : t("memHintNoProject")
        }
      />
      {!projectId && (
        <StateMessage kind="empty">{t("chooseProject")}</StateMessage>
      )}
      {projectId && overview.isLoading && <StateMessage kind="loading" />}
      {overview.error && (
        <StateMessage kind="error">
          {(overview.error as Error).message}
        </StateMessage>
      )}
      {o && !o.available && (
        <>
          <Notice tone="warning" testId="mem-unavailable">
            {t("memUnavailable", { reason: o.reason })}
          </Notice>
          <Settings project={projectId} settings={null} plugin={o.plugin} />
        </>
      )}
      {o?.available && (
        <>
          <OverviewTiles
            label={t("navMemory")}
            tiles={[
              {
                key: "obs",
                label: t("memTileObservations"),
                value: String(o.stats.observations),
                detail: o.stats.firstObservationAt
                  ? t("memSince", { when: fmt(o.stats.firstObservationAt) })
                  : t("tileNothing"),
                Icon: Brain,
              },
              {
                key: "sessions",
                label: t("memTileSessions"),
                value: String(o.stats.sessions),
                detail: t("memSummaries", { n: o.stats.summaries }),
                Icon: MessagesSquare,
              },
              {
                key: "db",
                label: t("memTileDb"),
                value: `${(o.stats.dbBytes / MB).toFixed(1)} Mo`,
                detail: `claude-mem ${o.worker.version}`,
                Icon: Database,
              },
              {
                key: "queue",
                label: t("memTileQueue"),
                value: String(o.processing.queueDepth),
                detail: o.processing.active ? t("memProcessing") : t("memIdle"),
                Icon: Hourglass,
              },
            ]}
          />
          {o.compliance.ok ? (
            <Notice tone="success" testId="mem-compliance">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {t("memCompliant", {
                  provider: o.compliance.provider,
                  auth: o.compliance.authMethod || "subscription",
                })}
              </span>
            </Notice>
          ) : (
            <Notice tone="danger" testId="mem-compliance">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {t("memNotCompliant", {
                  provider: o.compliance.provider,
                  auth: o.compliance.authMethod || "—",
                  fallback: o.compliance.fallbackProvider || "—",
                })}
              </span>
            </Notice>
          )}
          <Settings
            project={projectId}
            settings={o.settings}
            plugin={o.plugin}
          />
          <Observations project={projectId} projects={o.projects} />
        </>
      )}
    </FactoryShell>
  );
}
