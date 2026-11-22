/* eslint-disable i18next/no-literal-string -- factory UI is French-only */
import React from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useSearchParams } from "react-router";
import { cn } from "#/utils/utils";
import { useColorTheme } from "#/hooks/use-color-theme";
import { COLOR_THEMES } from "#/themes/color-themes";
import {
  FactoryApiError,
  fetchVersion,
  type NodeType,
  type ValidationResponse,
  type WorkflowDefinition,
  type WorkflowNode,
  useArchiveWorkflow,
  useDuplicateWorkflow,
  useNodeTypes,
  useResetWorkflow,
  useProjects,
  useRuns,
  useSaveWorkflow,
  useSetProjectWorkflows,
  useStartRun,
  useWorkflow,
  useWorkflows,
  validateDefinition,
} from "./api";
import {
  autoLayout,
  edgeId,
  problemsByNode,
  renameNode,
  toFlow,
  type WorkflowFlowNode,
} from "./graph";
import { blankDefinition, newNode, TYPE_COLOR } from "./defaults";
import { NodeInspector, WorkflowSettings } from "./inspector";
import { WorkflowNodeCard } from "./workflow-node";
import { RoutedEdge } from "./workflow-edge";

const ID_RE = /^[a-z][a-z0-9_-]{0,47}$/;
const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const nodeTypes = { workflow: WorkflowNodeCard };
const edgeTypes = { routed: RoutedEdge };
const button =
  "rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-surface-raised disabled:opacity-50";
const primary =
  "rounded bg-contrast px-3 py-1 text-xs font-semibold text-contrast-foreground disabled:opacity-50";
const input =
  "rounded border border-border bg-surface px-2 py-1 text-xs text-foreground";

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ----------------------------------------------------------------- sidebar

function WorkflowList({
  selected,
  onSelect,
  onCreate,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  onCreate: (id: string) => void;
}) {
  const [showArchived, setShowArchived] = React.useState(false);
  const { data, error, isLoading } = useWorkflows(showArchived);
  const [newId, setNewId] = React.useState("");
  return (
    <div className="flex flex-col gap-2" data-testid="wf-list">
      <div className="text-xs font-semibold uppercase text-muted">
        Workflows
      </div>
      {isLoading && <div className="text-xs text-muted">Chargement…</div>}
      {error && (
        <div className="text-xs text-status-error">{errorText(error)}</div>
      )}
      {data?.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => onSelect(w.id)}
          data-testid={`wf-list-${w.id}`}
          className={cn(
            "flex flex-col items-start rounded px-2 py-1 text-left hover:bg-surface-raised",
            selected === w.id && "bg-surface-raised",
          )}
        >
          <span className="text-sm text-foreground">
            {w.name}{" "}
            {w.archived && (
              <span className="text-3xs text-muted">(archivé)</span>
            )}
          </span>
          <span className="text-2xs text-muted">
            {w.id} · v{w.latestVersion}
            {w.builtin ? " · modèle" : ""}
          </span>
        </button>
      ))}
      <label className="flex items-center gap-1 text-2xs text-muted">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        afficher les archivés
      </label>
      <div className="flex gap-1">
        <input
          className={cn(input, "w-full font-mono")}
          placeholder="nouvel-id"
          value={newId}
          data-testid="wf-new-id"
          onChange={(e) => setNewId(e.target.value)}
        />
        <button
          type="button"
          className={button}
          disabled={!ID_RE.test(newId) || !!data?.some((w) => w.id === newId)}
          onClick={() => {
            onCreate(newId);
            setNewId("");
          }}
        >
          Nouveau
        </button>
      </div>
    </div>
  );
}

function Palette({ onAdd }: { onAdd: (t: NodeType) => void }) {
  const { data } = useNodeTypes();
  if (!data) return null;
  return (
    <div className="flex flex-col gap-1" data-testid="wf-palette">
      <div className="text-xs font-semibold uppercase text-muted">
        Ajouter un nœud
      </div>
      {data.catalog.map((c) => (
        <button
          key={c.type}
          type="button"
          title={c.description}
          data-testid={`wf-add-${c.type}`}
          onClick={() => onAdd(c.type)}
          className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs text-foreground hover:bg-surface-raised"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: TYPE_COLOR[c.type] }}
          />
          {c.label}
        </button>
      ))}
    </div>
  );
}

function ProjectsPanel({ workflowIds }: { workflowIds: string[] }) {
  const { data: projects, error } = useProjects();
  const setWf = useSetProjectWorkflows();
  const start = useStartRun();
  const [issue, setIssue] = React.useState("");
  const [startWf, setStartWf] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  if (error)
    return <div className="text-xs text-status-error">{errorText(error)}</div>;
  return (
    <div className="flex flex-col gap-4" data-testid="wf-projects">
      {projects?.map((p) => (
        <div
          key={p.id}
          className="flex flex-col gap-2 rounded border border-border p-2"
        >
          <div className="text-sm font-semibold text-foreground">
            {p.id}{" "}
            <span className="text-xs font-normal text-muted">{p.repo}</span>
          </div>
          <div className="text-xs text-muted">
            Workflows activés (● = par défaut, démarré par factory:ready)
          </div>
          {workflowIds.map((id) => {
            const enabled = p.enabledWorkflows.includes(id);
            return (
              <div
                key={id}
                className="flex items-center gap-2 text-xs text-foreground"
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={
                    setWf.isPending || (enabled && p.defaultWorkflow === id)
                  }
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...p.enabledWorkflows, id]
                      : p.enabledWorkflows.filter((x) => x !== id);
                    setMsg(null);
                    setWf.mutate(
                      {
                        projectId: p.id,
                        default: p.defaultWorkflow ?? id,
                        enabled: next,
                      },
                      { onError: (err) => setMsg(errorText(err)) },
                    );
                  }}
                />
                <input
                  type="radio"
                  name={`default-${p.id}`}
                  checked={p.defaultWorkflow === id}
                  disabled={!enabled || setWf.isPending}
                  onChange={() =>
                    setWf.mutate(
                      {
                        projectId: p.id,
                        default: id,
                        enabled: p.enabledWorkflows,
                      },
                      { onError: (err) => setMsg(errorText(err)) },
                    )
                  }
                />
                <span className="font-mono">{id}</span>
              </div>
            );
          })}
          <div className="mt-2 text-xs text-muted">
            Démarrer à la main sur une issue
          </div>
          <div className="flex flex-wrap gap-1">
            <input
              className={cn(input, "w-20")}
              placeholder="n° issue"
              value={issue}
              onChange={(e) => setIssue(e.target.value.replace(/\D/g, ""))}
            />
            <select
              className={input}
              value={startWf}
              onChange={(e) => setStartWf(e.target.value)}
            >
              <option value="">workflow…</option>
              {p.enabledWorkflows.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={button}
              disabled={!issue || !startWf || start.isPending}
              onClick={() => {
                setMsg(null);
                start.mutate(
                  {
                    projectId: p.id,
                    issue: Number(issue),
                    workflowId: startWf,
                  },
                  {
                    onSuccess: (r) =>
                      setMsg(`Run ${r.runId} créé pour #${issue}.`),
                    onError: (err) => setMsg(errorText(err)),
                  },
                );
              }}
            >
              Démarrer
            </button>
          </div>
        </div>
      ))}
      {msg && <div className="text-xs text-foreground">{msg}</div>}
    </div>
  );
}

function RunsPanel({ workflowId }: { workflowId: string | null }) {
  const { data, error } = useRuns();
  if (error)
    return <div className="text-xs text-status-error">{errorText(error)}</div>;
  const runs = (data ?? []).filter(
    (r) => !workflowId || r.workflow === workflowId,
  );
  return (
    <div className="flex flex-col gap-1" data-testid="wf-runs">
      {runs.length === 0 && (
        <div className="text-xs text-muted">Aucun run pour ce workflow.</div>
      )}
      {runs.map((r) => (
        <div
          key={r.id}
          className="flex flex-col rounded border border-border px-2 py-1 text-xs"
        >
          <span className="text-foreground">
            #{r.issue} {r.title}
          </span>
          <span className="text-muted">
            run {r.id} · {r.state} · v{r.version}
            {r.node ? ` · ${r.node}` : ""}
            {r.prNumber ? ` · PR #${r.prNumber}` : ""}
          </span>
          {r.conversationId && (
            <a
              className="text-muted underline"
              href={`../conversations/${r.conversationId}`}
            >
              conversation
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ editor

function Editor({
  workflowId,
  initialNode,
}: {
  workflowId: string;
  initialNode?: string | null;
}) {
  const initialNodeRef = React.useRef(initialNode ?? null);
  const { data, error, isLoading } = useWorkflow(workflowId);
  const { data: projects } = useProjects();
  const { data: runs } = useRuns();
  const save = useSaveWorkflow();
  // Follow Canvas' own theme (it does not follow prefers-color-scheme).
  const colorMode = COLOR_THEMES[useColorTheme()].appearance;
  const duplicate = useDuplicateWorkflow();
  const archive = useArchiveWorkflow();
  const reset = useResetWorkflow();

  const [def, setDef] = React.useState<WorkflowDefinition | null>(null);
  const [baseVersion, setBaseVersion] = React.useState<number>(0);
  const [viewVersion, setViewVersion] = React.useState<number | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = React.useState<string | null>(null);
  const [validation, setValidation] = React.useState<ValidationResponse | null>(
    null,
  );
  const [comment, setComment] = React.useState("");
  const [dupId, setDupId] = React.useState("");
  const [message, setMessage] = React.useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [side, setSide] = React.useState<"inspect" | "projects" | "runs">(
    "inspect",
  );
  // Controlled React Flow: measured sizes must be handed back to it.
  const [measured, setMeasured] = React.useState<
    Record<string, { width: number; height: number }>
  >({});

  // Load the latest version, and reload only when a NEW version exists (after a
  // save, here or elsewhere). Refetches of the same version (window focus,
  // invalidations) must not wipe the selection or unsaved edits.
  const latestVersion = data?.workflow.latestVersion;
  const loadedVersion = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!data || latestVersion === undefined) return;
    if (loadedVersion.current === latestVersion) return;
    loadedVersion.current = latestVersion;
    setDef({ ...data.definition, layout: autoLayout(data.definition) });
    setBaseVersion(latestVersion);
    setViewVersion(null);
    setDirty(false);
    setSelectedNode((current) => {
      const wanted = initialNodeRef.current ?? current;
      initialNodeRef.current = null;
      return data.definition.nodes.some((n) => n.id === wanted) ? wanted : null;
    });
  }, [data, latestVersion]);

  const projectId = projects?.[0]?.id;
  const commands = projects?.[0]?.commands ?? [];
  const builtin = !!data?.workflow.builtin;
  const oldVersion = viewVersion !== null && viewVersion !== baseVersion;
  // Built-ins are editable in place (each save is a new version); only an old
  // version on display is read-only.
  const readOnly = oldVersion;

  // Server-side validation (also returns each node's ports), debounced.
  React.useEffect(() => {
    if (!def) return undefined;
    const t = setTimeout(() => {
      validateDefinition(def, projectId)
        .then(setValidation)
        .catch((e) =>
          setValidation({
            ok: false,
            problems: [{ message: errorText(e) }],
            ports: {},
          }),
        );
    }, 400);
    return () => clearTimeout(t);
  }, [def, projectId]);

  const runsByNode = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of runs ?? []) {
      if (r.workflow !== workflowId || TERMINAL.has(r.state) || !r.node)
        continue;
      m.set(r.node, (m.get(r.node) ?? 0) + 1);
    }
    return m;
  }, [runs, workflowId]);

  const flow = React.useMemo(() => {
    if (!def) return { nodes: [], edges: [] };
    const f = toFlow(def, {
      ports: validation?.ports,
      problems: validation?.problems,
      runsByNode,
      sizes: measured,
      readOnly,
    });
    return {
      nodes: f.nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNode,
        measured: measured[n.id],
      })),
      edges: f.edges.map((e) => ({ ...e, selected: e.id === selectedEdge })),
    };
  }, [
    def,
    validation,
    runsByNode,
    readOnly,
    selectedNode,
    selectedEdge,
    measured,
  ]);

  const update = React.useCallback((next: WorkflowDefinition) => {
    setDef(next);
    setDirty(true);
    setMessage(null);
  }, []);

  const onNodesChange = React.useCallback(
    (changes: NodeChange<WorkflowFlowNode>[]) => {
      if (!def) return;
      let next = def;
      let changed = false;
      const dims: Record<string, { width: number; height: number }> = {};
      for (const c of changes) {
        if (c.type === "dimensions" && c.dimensions) {
          dims[c.id] = c.dimensions;
        } else if (c.type === "select") {
          if (c.selected) {
            setSelectedNode(c.id);
            setSelectedEdge(null);
            setSide("inspect");
          } else if (selectedNode === c.id) setSelectedNode(null);
        } else if (c.type === "position" && c.position && !readOnly) {
          next = {
            ...next,
            layout: {
              ...next.layout,
              [c.id]: {
                x: Math.round(c.position.x),
                y: Math.round(c.position.y),
              },
            },
          };
          changed = true;
        } else if (c.type === "remove" && !readOnly) {
          const layout = { ...next.layout };
          delete layout[c.id];
          next = {
            ...next,
            nodes: next.nodes.filter((n) => n.id !== c.id),
            edges: next.edges.filter((e) => e.from !== c.id && e.to !== c.id),
            layout,
          };
          if (selectedNode === c.id) setSelectedNode(null);
          changed = true;
        }
      }
      if (Object.keys(dims).length) setMeasured((m) => ({ ...m, ...dims }));
      if (changed) update(next);
    },
    [def, readOnly, selectedNode, update],
  );

  const onEdgesChange = React.useCallback(
    (changes: EdgeChange[]) => {
      if (!def) return;
      let next = def;
      let changed = false;
      for (const c of changes) {
        if (c.type === "select") {
          if (c.selected) {
            setSelectedEdge(c.id);
            setSelectedNode(null);
          } else if (selectedEdge === c.id) setSelectedEdge(null);
        } else if (c.type === "remove" && !readOnly) {
          next = {
            ...next,
            edges: next.edges.filter((e) => edgeId(e.from, e.port) !== c.id),
          };
          changed = true;
        }
      }
      if (changed) update(next);
    },
    [def, readOnly, selectedEdge, update],
  );

  const onConnect = React.useCallback(
    (c: Connection) => {
      if (!def || readOnly || !c.source || !c.target || !c.sourceHandle) return;
      // One edge per output port: a new connection replaces the old one.
      const edges = def.edges.filter(
        (e) => !(e.from === c.source && e.port === c.sourceHandle),
      );
      update({
        ...def,
        edges: [
          ...edges,
          { from: c.source, port: c.sourceHandle, to: c.target },
        ],
      });
    },
    [def, readOnly, update],
  );

  if (isLoading || !def)
    return <div className="p-4 text-sm text-muted">Chargement…</div>;
  if (error)
    return (
      <div className="p-4 text-sm text-status-error">{errorText(error)}</div>
    );

  const node = def.nodes.find((n) => n.id === selectedNode) ?? null;
  const probs = problemsByNode(validation?.problems ?? []);
  const globalProblems = (validation?.problems ?? []).filter(
    (p) => !p.node && !p.edge,
  );

  const doSave = () => {
    setMessage(null);
    save.mutate(
      {
        id: workflowId,
        definition: def,
        comment:
          comment || (oldVersion ? `restauration de la v${viewVersion}` : ""),
      },
      {
        onSuccess: (r) => {
          setComment("");
          setMessage({
            ok: true,
            text: `Version ${r.version} enregistrée. Les runs en cours gardent leur version.`,
          });
        },
        onError: (e) => {
          if (e instanceof FactoryApiError && e.problems.length)
            setValidation((v) => ({
              ok: false,
              problems: e.problems,
              ports: v?.ports ?? {},
            }));
          setMessage({ ok: false, text: errorText(e) });
        },
      },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <span
            className="text-sm font-semibold text-foreground"
            data-testid="wf-title"
          >
            {def.name}
          </span>
          <span className="font-mono text-xs text-muted">{workflowId}</span>
          <select
            className={input}
            value={viewVersion ?? baseVersion}
            data-testid="wf-version"
            onChange={async (e) => {
              const v = Number(e.target.value);
              if (v === baseVersion) {
                setDef({
                  ...data!.definition,
                  layout: autoLayout(data!.definition),
                });
                setViewVersion(null);
              } else {
                const d = await fetchVersion(workflowId, v);
                setDef({ ...d, layout: autoLayout(d) });
                setViewVersion(v);
              }
              setDirty(false);
              setSelectedNode(null);
            }}
          >
            {data?.versions.map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version} · {v.createdBy}
                {v.comment ? ` · ${v.comment}` : ""}
              </option>
            ))}
          </select>
          <span
            className={cn(
              "text-xs",
              validation?.ok ? "text-status-success" : "text-status-error",
            )}
            data-testid="wf-validity"
          >
            {validation
              ? validation.ok
                ? "✓ valide"
                : `⚠ ${validation.problems.length} problème(s)`
              : "…"}
          </span>
          {dirty && (
            <span className="text-xs text-feedback-warning">modifié</span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {!readOnly && (
              <button
                type="button"
                className={button}
                onClick={() =>
                  update({ ...def, layout: autoLayout(def, true) })
                }
              >
                Mise en page auto
              </button>
            )}
            {builtin && (
              <span className="text-xs text-muted" data-testid="wf-builtin">
                modèle intégré
                {data?.workflow.customised ? " (modifié)" : ""}
              </span>
            )}
            {oldVersion && (
              <button
                type="button"
                className={button}
                onClick={doSave}
                disabled={save.isPending}
              >
                Restaurer cette version
              </button>
            )}
            {!readOnly && (
              <>
                <input
                  className={cn(input, "w-48")}
                  placeholder="commentaire de version"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button
                  type="button"
                  className={primary}
                  disabled={!dirty || save.isPending}
                  onClick={doSave}
                  data-testid="wf-save"
                >
                  Enregistrer
                </button>
              </>
            )}
          </div>
        </div>
        {(message || globalProblems.length > 0) && (
          <div className="border-b border-border px-3 py-1 text-xs">
            {message && (
              <div
                className={
                  message.ok ? "text-status-success" : "text-status-error"
                }
              >
                {message.text}
              </div>
            )}
            {globalProblems.map((p) => (
              <div key={p.message} className="text-status-error">
                • {p.message}
              </div>
            ))}
          </div>
        )}
        <div className="relative min-h-0 flex-1" data-testid="wf-canvas">
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={() => {
              setSelectedNode(null);
              setSelectedEdge(null);
            }}
            nodesConnectable={!readOnly}
            deleteKeyCode={readOnly ? null : ["Delete", "Backspace"]}
            colorMode={colorMode}
            fitView
            minZoom={0.2}
            proOptions={{ hideAttribution: false }}
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </div>
      <aside className="flex w-80 shrink-0 flex-col border-l border-border">
        <div className="flex border-b border-border text-xs">
          {(
            [
              ["inspect", node ? "Nœud" : "Workflow"],
              ["runs", "Runs"],
              ["projects", "Projets"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSide(k)}
              className={cn(
                "flex-1 px-2 py-2",
                side === k ? "text-foreground font-semibold" : "text-muted",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {side === "inspect" &&
            (node ? (
              <NodeInspector
                node={node}
                readOnly={readOnly}
                commands={commands}
                problems={probs.get(node.id) ?? []}
                onChange={(n: WorkflowNode) =>
                  update({
                    ...def,
                    nodes: def.nodes.map((x) => (x.id === node.id ? n : x)),
                  })
                }
                onRename={(to) => {
                  if (def.nodes.some((n) => n.id === to)) {
                    setMessage({
                      ok: false,
                      text: `L’identifiant ${to} existe déjà.`,
                    });
                    return;
                  }
                  update(renameNode(def, node.id, to));
                  setSelectedNode(to);
                }}
                onDelete={() =>
                  onNodesChange([{ type: "remove", id: node.id }])
                }
              />
            ) : (
              <div className="flex flex-col gap-4">
                <WorkflowSettings
                  def={def}
                  readOnly={readOnly}
                  onChange={update}
                />
                {!readOnly && (
                  <Palette
                    onAdd={(t) => {
                      const n = newNode(def, t);
                      const xs = Object.values(def.layout);
                      const x = xs.length
                        ? Math.max(...xs.map((p) => p.x)) + 280
                        : 0;
                      update({
                        ...def,
                        nodes: [...def.nodes, n],
                        layout: { ...def.layout, [n.id]: { x, y: 0 } },
                      });
                      setSelectedNode(n.id);
                    }}
                  />
                )}
                <div className="flex flex-col gap-1 border-t border-border pt-3">
                  <div className="text-xs text-muted">
                    Dupliquer sous un nouvel identifiant
                  </div>
                  <div className="flex gap-1">
                    <input
                      className={cn(input, "w-full font-mono")}
                      placeholder="mon-workflow"
                      value={dupId}
                      data-testid="wf-dup-id"
                      onChange={(e) => setDupId(e.target.value)}
                    />
                    <button
                      type="button"
                      className={button}
                      disabled={!ID_RE.test(dupId) || duplicate.isPending}
                      data-testid="wf-duplicate"
                      onClick={() =>
                        duplicate.mutate(
                          { id: workflowId, newId: dupId },
                          {
                            onSuccess: (r) => {
                              setDupId("");
                              setMessage({
                                ok: true,
                                text: `Copie créée : ${r.id}. Sélectionne-la dans la liste.`,
                              });
                            },
                            onError: (e) =>
                              setMessage({ ok: false, text: errorText(e) }),
                          },
                        )
                      }
                    >
                      Dupliquer
                    </button>
                  </div>
                  {builtin && data?.workflow.customised && (
                    <button
                      type="button"
                      className="mt-2 self-start text-xs text-muted hover:text-foreground"
                      data-testid="wf-reset"
                      disabled={reset.isPending || dirty}
                      title={
                        dirty ? "Enregistre ou recharge d’abord" : undefined
                      }
                      onClick={() =>
                        reset.mutate(workflowId, {
                          onSuccess: (r) =>
                            setMessage({
                              ok: true,
                              text: `Modèle d’origine restauré (version ${r.version}).`,
                            }),
                          onError: (e) =>
                            setMessage({ ok: false, text: errorText(e) }),
                        })
                      }
                    >
                      Revenir au modèle d’origine
                    </button>
                  )}
                  {!builtin && (
                    <button
                      type="button"
                      className="mt-2 self-start text-xs text-muted hover:text-foreground"
                      onClick={() =>
                        archive.mutate(
                          {
                            id: workflowId,
                            archived: !data?.workflow.archived,
                          },
                          {
                            onError: (e) =>
                              setMessage({ ok: false, text: errorText(e) }),
                          },
                        )
                      }
                    >
                      {data?.workflow.archived ? "Désarchiver" : "Archiver"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          {side === "runs" && <RunsPanel workflowId={workflowId} />}
          {side === "projects" && (
            <ProjectsPanel
              workflowIds={[
                workflowId,
                ...(projects?.[0]?.enabledWorkflows ?? []),
              ].filter((v, i, a) => a.indexOf(v) === i)}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

// -------------------------------------------------------------------- page

export default function WorkflowsPage() {
  const { data: workflows } = useWorkflows();
  const save = useSaveWorkflow();
  // ?wf=<id>&node=<id>: opened from a ticket conversation ("Modifier le workflow").
  const [params] = useSearchParams();
  const [selected, setSelected] = React.useState<string | null>(
    params.get("wf"),
  );
  const [createError, setCreateError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selected && workflows?.length)
      setSelected(
        workflows.find((w) => w.id === "speckit-full")?.id ?? workflows[0]!.id,
      );
  }, [selected, workflows]);

  return (
    <ReactFlowProvider>
      <div
        className="flex h-full min-h-0 w-full"
        data-testid="factory-workflows-page"
      >
        <div className="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-3">
          <WorkflowList
            selected={selected}
            onSelect={setSelected}
            onCreate={(id) => {
              setCreateError(null);
              save.mutate(
                { id, definition: blankDefinition(id), comment: "création" },
                {
                  onSuccess: () => setSelected(id),
                  onError: (e) => setCreateError(errorText(e)),
                },
              );
            }}
          />
          {createError && (
            <div className="text-xs text-status-error">{createError}</div>
          )}
        </div>
        {selected ? (
          <Editor
            key={selected}
            workflowId={selected}
            initialNode={
              selected === params.get("wf") ? params.get("node") : null
            }
          />
        ) : (
          <div className="p-4 text-sm text-muted">Sélectionne un workflow.</div>
        )}
      </div>
    </ReactFlowProvider>
  );
}
