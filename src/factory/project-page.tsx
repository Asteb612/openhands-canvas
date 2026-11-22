/* eslint-disable i18next/no-literal-string -- factory UI is French-only */
import React from "react";
import toast from "react-hot-toast";
import { useQueries } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { cn } from "#/utils/utils";
import { runStateOf } from "./run-status";
import { useSelectedProject } from "./project-context";
import {
  factoryFetch,
  NOTIFY_KINDS,
  useFactoryStatus,
  useSaveProjectSettings,
  useSetProjectWorkflows,
  useWorkflows,
  type BoardColumn,
  type FactoryProject,
  type NotifyKind,
  type WorkflowDefinition,
} from "./workflows/api";
import { DEFAULT_COLUMNS, RUN_STATES } from "./tickets/columns";
import {
  enableBrowserNotifications,
  notificationsSupported,
  useNotifyPref,
} from "./notifier";

const input =
  "rounded border border-border bg-base-secondary px-2 py-1 text-xs text-foreground";
const button =
  "cursor-pointer rounded border border-border px-2 py-1 text-xs hover:bg-tertiary disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "cursor-pointer rounded bg-contrast px-3 py-1 text-xs font-semibold text-contrast-foreground hover:opacity-90 disabled:opacity-50";

const NOTIFY_LABEL: Record<NotifyKind, string> = {
  human: "Décision attendue",
  failed: "Échec",
  quota: "Quota atteint",
  completed: "Terminé",
};

function Section({
  title,
  hint,
  children,
  testId,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section
      className="flex flex-col gap-2 rounded-md border border-border p-3"
      data-testid={testId}
    >
      <header>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

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

function WorkflowsSection({ project }: { project: FactoryProject }) {
  const { data: workflows } = useWorkflows();
  const setWf = useSetProjectWorkflows();
  const save = (def: string, enabled: string[]) =>
    setWf.mutate(
      { projectId: project.id, default: def, enabled },
      {
        onSuccess: () => toast.success("Workflows du projet enregistrés"),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  return (
    <Section
      title="Workflows du projet"
      hint="Ceux proposés comme type de tâche et dont les déclencheurs s'appliquent ici. Le workflow par défaut démarre sur factory:ready."
      testId="project-workflows"
    >
      <table className="text-xs">
        <thead className="text-muted">
          <tr>
            <th className="w-16 text-left font-normal">Activé</th>
            <th className="w-20 text-left font-normal">Par défaut</th>
            <th className="text-left font-normal">Workflow</th>
          </tr>
        </thead>
        <tbody>
          {(workflows ?? []).map((w) => {
            const enabled = project.enabledWorkflows.includes(w.id);
            const isDefault = project.defaultWorkflow === w.id;
            return (
              <tr key={w.id}>
                <td>
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
                    aria-label={`Activer ${w.name}`}
                  />
                </td>
                <td>
                  <input
                    type="radio"
                    name="default-workflow"
                    checked={isDefault}
                    disabled={!enabled || setWf.isPending}
                    onChange={() => save(w.id, project.enabledWorkflows)}
                    aria-label={`${w.name} par défaut`}
                  />
                </td>
                <td className="py-0.5">
                  <span className="text-foreground">{w.name}</span>{" "}
                  <span className="font-mono text-muted">{w.id}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

/** "workflow/node" choices from the latest version of each enabled workflow. */
function useNodeChoices(workflowIds: string[]) {
  const results = useQueries({
    queries: workflowIds.map((id) => ({
      queryKey: ["factory", "workflow", id],
      queryFn: () =>
        factoryFetch<{
          workflow: { name: string };
          definition: WorkflowDefinition;
        }>(`/workflows/${encodeURIComponent(id)}`),
      refetchOnWindowFocus: false,
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
  const [pick, setPick] = React.useState("");
  const toggleState = (s: string) => {
    const states = value.states ?? [];
    onChange({
      ...value,
      states: states.includes(s)
        ? states.filter((x) => x !== s)
        : [...states, s],
    });
  };
  const nodes = value.nodes ?? [];
  const labelOf = (k: string) =>
    k.startsWith("*/")
      ? `toute étape « ${k.slice(2)} »`
      : (nodeChoices.find((c) => c.key === k)?.label ?? k);
  // Same node id in several workflows: offer the "*/<id>" shortcut too.
  const ids = [...new Set(nodeChoices.map((c) => c.nodeId))].filter(
    (id) => nodeChoices.filter((c) => c.nodeId === id).length > 1,
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-0.5 text-3xs text-muted">
          Titre
          <input
            className={cn(input, "w-40")}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            data-testid={`column-title-${value.id}`}
          />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-0.5 text-3xs text-muted">
          Aide (sous le titre)
          <input
            className={input}
            value={value.hint ?? ""}
            onChange={(e) => onChange({ ...value, hint: e.target.value })}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-3xs text-muted">
        États :
        {RUN_STATES.map((s) => {
          const on = (value.states ?? []).includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleState(s)}
              className={cn(
                "cursor-pointer rounded-full border px-2 leading-5",
                on
                  ? "border-contrast text-foreground"
                  : "border-border text-muted",
              )}
              aria-pressed={on}
              data-testid={`column-${value.id}-state-${s}`}
            >
              {runStateOf(s).label}
            </button>
          );
        })}
        {!(value.states ?? []).length && <span>(tous)</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1 text-3xs text-muted">
        Étapes :
        {nodes.map((k) => (
          <span
            key={k}
            className="flex items-center gap-1 rounded-full border border-border px-2 leading-5 text-foreground"
          >
            {labelOf(k)}
            <button
              type="button"
              className="cursor-pointer text-muted hover:text-foreground"
              onClick={() =>
                onChange({ ...value, nodes: nodes.filter((x) => x !== k) })
              }
              aria-label={`Retirer ${labelOf(k)}`}
            >
              ×
            </button>
          </span>
        ))}
        {!nodes.length && <span>(toutes)</span>}
        <select
          className={cn(input, "text-3xs")}
          value={pick}
          onChange={(e) => {
            const k = e.target.value;
            setPick("");
            if (k && !nodes.includes(k))
              onChange({ ...value, nodes: [...nodes, k] });
          }}
          data-testid={`column-${value.id}-add-node`}
        >
          <option value="">+ étape…</option>
          {ids.map((id) => (
            <option key={`*/${id}`} value={`*/${id}`}>
              toute étape « {id} »
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
  const save = useSaveProjectSettings();
  const saved = project.settings?.columns;
  const [cols, setCols] = React.useState<BoardColumn[]>(
    saved?.length ? saved : DEFAULT_COLUMNS,
  );
  const [dirty, setDirty] = React.useState(false);
  React.useEffect(() => {
    setCols(saved?.length ? saved : DEFAULT_COLUMNS);
    setDirty(false);
  }, [project.id, saved]);
  const nodeChoices = useNodeChoices(project.enabledWorkflows);

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
  const persist = (columns: BoardColumn[] | undefined) =>
    save.mutate(
      {
        projectId: project.id,
        settings: {
          notify: project.settings?.notify ?? {
            events: ["human", "failed", "quota"],
          },
          ...(columns ? { columns } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success("Colonnes enregistrées");
          setDirty(false);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );

  return (
    <Section
      title="Colonnes du tableau Tickets"
      hint="Un ticket va dans la première colonne dont tous les filtres correspondent (états et étapes ; vide = tout). Ceux qui ne correspondent à aucune colonne vont dans « Autres »."
      testId="project-columns"
    >
      <ol className="flex flex-col gap-2">
        {cols.map((c, i) => (
          <li
            key={c.id}
            className="flex gap-2 rounded border border-border p-2"
            data-testid={`column-row-${c.id}`}
          >
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="cursor-pointer text-muted hover:text-foreground disabled:opacity-30"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label="Monter"
              >
                <ArrowUp className="size-3" />
              </button>
              <button
                type="button"
                className="cursor-pointer text-muted hover:text-foreground disabled:opacity-30"
                disabled={i === cols.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Descendre"
              >
                <ArrowDown className="size-3" />
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
              className="cursor-pointer self-start text-muted hover:text-status-error"
              onClick={() => edit(cols.filter((x) => x.id !== c.id))}
              aria-label={`Supprimer ${c.title}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          disabled={cols.length >= 12}
          onClick={() =>
            edit([
              ...cols,
              {
                id: slugify(
                  "nouvelle",
                  cols.map((c) => c.id),
                ),
                title: "Nouvelle colonne",
                hint: "",
                states: [],
                nodes: [],
              },
            ])
          }
          data-testid="column-add"
        >
          + Colonne
        </button>
        <button
          type="button"
          className={button}
          onClick={() => persist(undefined)}
          disabled={save.isPending || !saved?.length}
          title="Revenir aux colonnes par état"
        >
          Colonnes par défaut
        </button>
        <button
          type="button"
          className={cn(primary, "ml-auto")}
          disabled={
            !dirty || save.isPending || cols.some((c) => !c.title.trim())
          }
          onClick={() => persist(cols)}
          data-testid="columns-save"
        >
          Enregistrer les colonnes
        </button>
      </div>
    </Section>
  );
}

function NotificationsSection({ project }: { project: FactoryProject }) {
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
        settings: {
          ...(project.settings ?? {}),
          notify: { events: next },
        },
      },
      { onError: (e) => toast.error((e as Error).message) },
    );
  };
  return (
    <Section
      title="Notifications"
      hint="Navigateur : tant qu'un onglet Canvas est ouvert (tous projets). Push ntfy : même onglet fermé, envoyé par l'orchestrateur."
      testId="project-notifications"
    >
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted">Navigateur (cet appareil) :</span>
        {notificationsSupported() ? (
          <button
            type="button"
            className={button}
            onClick={async () => {
              if (notifyOn) setNotify(false);
              else if (!(await enableBrowserNotifications()))
                toast.error("Notifications refusées par le navigateur.");
            }}
          >
            {notifyOn ? "Activées (désactiver)" : "Activer"}
          </button>
        ) : (
          <span className="text-muted">non supportées</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted">
          Push ntfy{" "}
          {status?.push ? "(configuré)" : "(non configuré : FACTORY_NTFY_URL)"}{" "}
          :
        </span>
        {NOTIFY_KINDS.map((k) => (
          <label key={k} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={events.includes(k)}
              disabled={save.isPending}
              onChange={() => toggle(k)}
              data-testid={`notify-${k}`}
            />
            {NOTIFY_LABEL[k]}
          </label>
        ))}
      </div>
    </Section>
  );
}

function ConfigSection({ project }: { project: FactoryProject }) {
  const c = project.config;
  return (
    <Section
      title="Configuration versionnée"
      hint={`Lecture seule : config/projects/${project.id}.yaml dans software-factory (PR pour la modifier).`}
    >
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted">Dépôt</dt>
        <dd>
          <a
            href={`https://github.com/${project.repo}`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {project.repo}
          </a>
        </dd>
        <dt className="text-muted">Actif</dt>
        <dd>{project.active ? "oui" : "non (aucun run lancé)"}</dd>
        {c && (
          <>
            <dt className="text-muted">Branche</dt>
            <dd className="font-mono">{c.defaultBranch}</dd>
            <dt className="text-muted">Agents en parallèle</dt>
            <dd>{c.concurrency}</dd>
            <dt className="text-muted">GitHub Project</dt>
            <dd>{c.githubProject ? "suivi" : "non"}</dd>
          </>
        )}
        <dt className="text-muted">Commandes</dt>
        <dd className="font-mono">{project.commands.join(", ") || "—"}</dd>
      </dl>
    </Section>
  );
}

/** Per-project factory configuration, for the project picked in the sidebar. */
export default function FactoryProjectPage() {
  const { project, projects, setProjectId } = useSelectedProject();
  return (
    <div
      className="flex h-full flex-col gap-3 overflow-y-auto p-4"
      data-testid="factory-project-page"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Projet</h1>
        <select
          className={input}
          value={project?.id ?? ""}
          onChange={(e) => setProjectId(e.target.value)}
          data-testid="project-page-selector"
        >
          <option value="">Choisir un projet…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} ({p.repo})
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">
          (même choix que le sélecteur de la barre latérale)
        </span>
      </div>
      {!project && (
        <p className="text-sm text-muted">
          Choisis un projet pour configurer ses workflows, ses colonnes et ses
          notifications.
        </p>
      )}
      {project && (
        <div className="grid max-w-5xl grid-cols-1 gap-3">
          <WorkflowsSection project={project} />
          <ColumnsSection key={project.id} project={project} />
          <NotificationsSection project={project} />
          <ConfigSection project={project} />
        </div>
      )}
    </div>
  );
}
