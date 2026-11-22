/**
 * State of the workflow editor: the definition being edited (React Flow is fully
 * controlled from it), the version on display, selection, measured node sizes, and
 * the server's validation (problems + each node's ports).
 *
 * Refetch safety: the definition is (re)loaded only when a NEW version arrives (after
 * a save, here or elsewhere); refetches of the same version keep edits and selection.
 */
import React from "react";
import type { Connection, EdgeChange, NodeChange } from "@xyflow/react";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import {
  FactoryApiError,
  fetchVersion,
  reportFactoryError,
  useRuns,
  useSaveWorkflow,
  useWorkflow,
  useWorkflowStats,
  validateDefinition,
  type NodeType,
  type ValidationResponse,
  type WorkflowDefinition,
  type WorkflowNode,
  type WorkflowScope,
} from "../api";
import { useFactoryT } from "../i18n";
import { isTerminal } from "../states";
import {
  autoLayout,
  edgeId,
  renameNode,
  toFlow,
  type WorkflowFlowNode,
} from "./graph";
import { newNode } from "./defaults";

type Size = { width: number; height: number };
export type SidePanel = "inspect" | "runs";

const withLayout = (d: WorkflowDefinition): WorkflowDefinition => ({
  ...d,
  layout: autoLayout(d),
});

export function useWorkflowEditor({
  scope,
  workflowId,
  initialNode,
}: {
  scope: WorkflowScope;
  workflowId: string;
  initialNode?: string | null;
}) {
  const t = useFactoryT();
  const project = scope.kind === "project" ? scope.project : null;
  const query = useWorkflow(scope, workflowId);
  const { data } = query;
  const { data: runs } = useRuns(project ?? undefined);
  const save = useSaveWorkflow();

  const initialNodeRef = React.useRef(initialNode ?? null);
  const [def, setDef] = React.useState<WorkflowDefinition | null>(null);
  const [baseVersion, setBaseVersion] = React.useState(0);
  const [viewVersion, setViewVersion] = React.useState<number | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = React.useState<string | null>(null);
  const [validation, setValidation] = React.useState<ValidationResponse | null>(
    null,
  );
  const [panel, setPanel] = React.useState<SidePanel>("inspect");
  const [showStats, setShowStats] = React.useState(false);
  // Controlled React Flow: measured sizes must be handed back to it.
  const [measured, setMeasured] = React.useState<Record<string, Size>>({});

  const latestVersion = data?.workflow.latestVersion;
  const loadedVersion = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!data || latestVersion === undefined) return;
    if (loadedVersion.current === latestVersion) return;
    loadedVersion.current = latestVersion;
    setDef(withLayout(data.definition));
    setBaseVersion(latestVersion);
    setViewVersion(null);
    setDirty(false);
    setSelectedNode((current) => {
      const wanted = initialNodeRef.current ?? current;
      initialNodeRef.current = null;
      return data.definition.nodes.some((n) => n.id === wanted) ? wanted : null;
    });
  }, [data, latestVersion]);

  const oldVersion = viewVersion !== null && viewVersion !== baseVersion;
  // Built-ins are editable in place (each save is a new version); only an old version
  // on display is read-only.
  const readOnly = oldVersion;

  // Server-side validation in the workflow's scope (project commands are checked for a
  // project's workflow); also returns each node's ports. Debounced.
  React.useEffect(() => {
    if (!def) return undefined;
    const timer = setTimeout(() => {
      validateDefinition(scope, def)
        .then(setValidation)
        .catch((e: unknown) =>
          setValidation({
            ok: false,
            problems: [{ message: e instanceof Error ? e.message : String(e) }],
            ports: {},
          }),
        );
    }, 400);
    return () => clearTimeout(timer);
    // scope is a fresh object on each render: depend on its identity fields.
  }, [def, scope.kind, project]);

  // Statistics: only a project's workflow has runs.
  const { data: stats } = useWorkflowStats(
    showStats ? project : null,
    workflowId,
  );
  const statsByNode = React.useMemo(
    () =>
      showStats && stats
        ? new Map(stats.nodes.map((n) => [n.node, n]))
        : undefined,
    [showStats, stats],
  );

  // Open runs of this project and this workflow, per node.
  const workflowRuns = React.useMemo(
    () =>
      project
        ? (runs ?? []).filter(
            (r) => r.project === project && r.workflow === workflowId,
          )
        : [],
    [runs, project, workflowId],
  );
  const runsByNode = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of workflowRuns) {
      if (isTerminal(r.state) || !r.node) continue;
      m.set(r.node, (m.get(r.node) ?? 0) + 1);
    }
    return m;
  }, [workflowRuns]);

  const flow = React.useMemo(() => {
    if (!def) return { nodes: [], edges: [] };
    const f = toFlow(def, {
      ports: validation?.ports,
      problems: validation?.problems,
      runsByNode,
      statsByNode,
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
    statsByNode,
    readOnly,
    selectedNode,
    selectedEdge,
    measured,
  ]);

  const update = React.useCallback((next: WorkflowDefinition) => {
    setDef(next);
    setDirty(true);
  }, []);

  const onNodesChange = React.useCallback(
    (changes: NodeChange<WorkflowFlowNode>[]) => {
      if (!def) return;
      let next = def;
      let changed = false;
      const dims: Record<string, Size> = {};
      for (const c of changes) {
        if (c.type === "dimensions" && c.dimensions) {
          dims[c.id] = c.dimensions;
        } else if (c.type === "select") {
          if (c.selected) {
            setSelectedNode(c.id);
            setSelectedEdge(null);
            setPanel("inspect");
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

  const clearSelection = React.useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const selectVersion = async (v: number) => {
    if (!data) return;
    try {
      if (v === baseVersion) {
        setDef(withLayout(data.definition));
        setViewVersion(null);
      } else {
        setDef(withLayout(await fetchVersion(scope, workflowId, v)));
        setViewVersion(v);
      }
      setDirty(false);
      setSelectedNode(null);
    } catch (e) {
      reportFactoryError(e);
    }
  };

  const addNode = (type: NodeType) => {
    if (!def) return;
    const n = newNode(def, type, t);
    const xs = Object.values(def.layout);
    const x = xs.length ? Math.max(...xs.map((p) => p.x)) + 280 : 0;
    update({
      ...def,
      nodes: [...def.nodes, n],
      layout: { ...def.layout, [n.id]: { x, y: 0 } },
    });
    setSelectedNode(n.id);
  };

  const changeNode = (id: string, n: WorkflowNode) => {
    if (def)
      update({ ...def, nodes: def.nodes.map((x) => (x.id === id ? n : x)) });
  };

  const rename = (from: string, to: string) => {
    if (!def) return;
    if (def.nodes.some((n) => n.id === to)) {
      reportFactoryError(t("wfIdTaken", { id: to }));
      return;
    }
    update(renameNode(def, from, to));
    setSelectedNode(to);
  };

  const relayout = () =>
    def && update({ ...def, layout: autoLayout(def, true) });

  const doSave = (comment: string, onSaved?: () => void) => {
    if (!def) return;
    save.mutate(
      {
        scope,
        id: workflowId,
        definition: def,
        comment:
          comment ||
          (oldVersion ? t("wfRestoreComment", { v: viewVersion ?? 0 }) : ""),
      },
      {
        onSuccess: (r) => {
          onSaved?.();
          displaySuccessToast(t("wfSaved", { v: r.version }));
        },
        onError: (e) => {
          if (e instanceof FactoryApiError && e.problems.length)
            setValidation((v) => ({
              ok: false,
              problems: e.problems,
              ports: v?.ports ?? {},
            }));
          reportFactoryError(e);
        },
      },
    );
  };

  return {
    query,
    summary: data?.workflow,
    versions: data?.versions ?? [],
    def,
    update,
    baseVersion,
    viewVersion,
    oldVersion,
    readOnly,
    dirty,
    validation,
    selectedNode,
    flow,
    onNodesChange,
    onEdgesChange,
    onConnect,
    clearSelection,
    selectVersion,
    addNode,
    changeNode,
    rename,
    relayout,
    save: doSave,
    saving: save.isPending,
    panel,
    setPanel,
    showStats,
    setShowStats,
    stats: showStats ? stats : undefined,
    workflowRuns,
  };
}

export type WorkflowEditorState = ReturnType<typeof useWorkflowEditor>;
