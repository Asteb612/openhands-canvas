/**
 * Workflow tab of a conversation where the agent writes a workflow: the draft as a
 * graph, the orchestrator's verdict, the owner's hand edits (click a node, or "Name and
 * settings") and the owner's Save (a new version, or a new workflow with its id). The
 * agent never saves. A part edited by hand is the owner's: the orchestrator reverts
 * the agent's changes to it until the owner hands it back.
 */
import React from "react";
import { Link } from "react-router";
import {
  CheckCircle2,
  ExternalLink,
  Info,
  Lock,
  Save,
  SlidersHorizontal,
  Undo2,
  X,
} from "lucide-react";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import {
  reportFactoryError,
  useProjects,
  type WorkflowDefinition,
  type WorkflowNode,
} from "../api";
import { useFactoryT } from "../i18n";
import {
  Button,
  Field,
  Notice,
  Pill,
  StateMessage,
  fieldClassName,
  textActionClassName,
} from "../ui";
import { ID_RE } from "./inspector-fields";
import { NodeInspector, WorkflowSettings } from "./inspector";
import { DefinitionGraph } from "./workflow-preview";
import {
  useSaveWorkflowSession,
  useSessionEdits,
  useWorkflowSession,
  useWorkflowSessionId,
  type WorkflowSession,
} from "./workflow-session";

const WORKFLOW_PART = "_workflow";
type WorkflowPart = Pick<
  WorkflowDefinition,
  "name" | "description" | "settings"
>;

/**
 * What the owner is typing, sent once they pause: the poll keeps refreshing the draft
 * meanwhile, so the form shows the local value until the server has it.
 */
function useDebouncedEdit<T>(
  send: (v: T, done: () => void) => void,
  delay = 700,
) {
  const [local, setLocal] = React.useState<{ key: string; value: T } | null>(
    null,
  );
  const pending = React.useRef<{ key: string; value: T } | null>(null);
  const timer = React.useRef<number | undefined>(undefined);
  const sendRef = React.useRef(send);
  sendRef.current = send;
  const flush = React.useCallback(() => {
    window.clearTimeout(timer.current);
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    sendRef.current(p.value, () => {
      // The server has it (and nothing newer waits): show the server's draft again.
      if (!pending.current) setLocal(null);
    });
  }, []);
  const change = (key: string, value: T) => {
    setLocal({ key, value });
    pending.current = { key, value };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, delay);
  };
  React.useEffect(() => flush, [flush]);
  return { local, change, flush, busy: local !== null };
}

function EditPanel({
  title,
  owned,
  onRelease,
  onClose,
  testId,
  children,
}: {
  title: string;
  owned: boolean;
  onRelease: () => void;
  onClose: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  const t = useFactoryT();
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-border bg-base-secondary p-3"
      data-testid={testId}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-sm font-medium text-content">{title}</h3>
        {owned && (
          <Pill
            icon={<Lock className="size-3" aria-hidden />}
            title={t("agentOwnedHint")}
            testId="wf-session-owned-pill"
          >
            {t("agentOwned")}
          </Pill>
        )}
        <div className="ml-auto flex items-center gap-3">
          {owned && (
            <button
              type="button"
              className={`${textActionClassName} inline-flex items-center gap-1`}
              onClick={onRelease}
              data-testid="wf-session-release"
            >
              <Undo2 className="size-3.5" aria-hidden />
              {t("agentRelease")}
            </button>
          )}
          <button
            type="button"
            aria-label={t("close")}
            className="cursor-pointer text-muted hover:text-content"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </header>
      {children}
    </section>
  );
}

/** Agent changes to the owner's parts were reverted (until dismissed). */
function RestoredNotice({ data }: { data: WorkflowSession }) {
  const t = useFactoryT();
  const [dismissed, setDismissed] = React.useState<string | null>(null);
  const r = data.restored;
  if (!r || r.at === dismissed) return null;
  const parts = [
    ...r.nodes,
    ...(r.workflow ? [t("agentRestoredWorkflow")] : []),
  ].join(", ");
  return (
    <Notice tone="warning">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex-1" data-testid="wf-session-restored">
        {t("agentRestored", { parts })}
      </span>
      <button
        type="button"
        aria-label={t("close")}
        className="cursor-pointer text-muted hover:text-content"
        onClick={() => setDismissed(r.at)}
      >
        <X className="size-4" />
      </button>
    </Notice>
  );
}

export default function WorkflowSessionTab() {
  const t = useFactoryT();
  const ref = useWorkflowSessionId();
  const { data, error, isLoading } = useWorkflowSession(ref);
  const save = useSaveWorkflowSession();
  const edits = useSessionEdits(ref);
  const { data: projects } = useProjects();
  const commands = projects?.find((p) => p.id === ref?.project)?.commands ?? [];
  const [newId, setNewId] = React.useState("");
  const [saved, setSaved] = React.useState<{
    id: string;
    version: number;
  } | null>(null);
  /** A node id, WORKFLOW_PART, or "" (nothing open). */
  const [open, setOpen] = React.useState("");

  const nodeEdit = useDebouncedEdit<WorkflowNode>((n, done) =>
    edits.node.mutate(n, { onSuccess: done, onError: reportFactoryError }),
  );
  const wfEdit = useDebouncedEdit<WorkflowPart>((w, done) =>
    edits.workflow.mutate(w, { onSuccess: done, onError: reportFactoryError }),
  );
  const select = (id: string) => {
    nodeEdit.flush();
    wfEdit.flush();
    setOpen((cur) => (cur === id ? "" : id));
  };

  if (!ref) return null;
  if (isLoading) return <StateMessage kind="loading" />;
  if (error || !data)
    return (
      <StateMessage kind="error">
        {(error as Error | null)?.message}
      </StateMessage>
    );

  const template = data.scope === "template";
  const target = data.workflowId;
  const detail = target
    ? `/factory/workflows/${encodeURIComponent(target)}${template ? "?scope=template" : ""}`
    : null;
  const doSave = () =>
    save.mutate(
      {
        project: ref.project,
        session: ref.session,
        id: target ? undefined : newId,
      },
      {
        onSuccess: (r) => {
          setSaved({ id: r.id, version: r.version });
          displaySuccessToast(t("agentSaved", { id: r.id, v: r.version }));
        },
        onError: reportFactoryError,
      },
    );
  const release = (part: string) =>
    edits.release.mutate(part, {
      onSuccess: () => displaySuccessToast(t("agentReleased")),
      onError: reportFactoryError,
    });

  // The draft as the owner sees it: their pending edit on top of the server's.
  const def = data.definition;
  const shown: WorkflowDefinition | null = def
    ? {
        ...def,
        ...(wfEdit.local?.value ?? {}),
        nodes: def.nodes.map((n) =>
          nodeEdit.local?.key === n.id ? nodeEdit.local.value : n,
        ),
      }
    : null;
  const openNode =
    open && open !== WORKFLOW_PART
      ? (shown?.nodes.find((n) => n.id === open) ?? null)
      : null;
  const editing = nodeEdit.busy || wfEdit.busy;
  const owned = new Set(data.ownerNodes);

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3"
      data-testid="wf-session-tab"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 truncate text-base font-medium text-content">
          {shown?.name ?? t("agentNewWorkflow")}
        </h2>
        <Pill>
          {template
            ? t("templates")
            : t("projectWorkflows", { p: ref.project })}
        </Pill>
        <Pill
          tone={data.ok ? "success" : "warning"}
          testId="wf-session-validity"
        >
          {data.ok
            ? t("wfValid")
            : t("wfProblems", { n: data.problems.length })}
        </Pill>
        {editing && (
          <Pill testId="wf-session-editing">{t("agentDraftSaving")}</Pill>
        )}
        <div className="ml-auto flex items-center gap-3">
          {shown && (
            <button
              type="button"
              className={`${textActionClassName} inline-flex items-center gap-1`}
              aria-pressed={open === WORKFLOW_PART}
              onClick={() => select(WORKFLOW_PART)}
              data-testid="wf-session-settings"
            >
              <SlidersHorizontal className="size-3.5" aria-hidden />
              {t("agentWorkflowSettings")}
              {data.ownerWorkflow && <Lock className="size-3" aria-hidden />}
            </button>
          )}
          {detail && (
            <Link
              to={detail}
              className={`${textActionClassName} inline-flex items-center gap-1`}
            >
              <ExternalLink className="size-3.5" aria-hidden />
              {t("open")}
            </Link>
          )}
        </div>
      </header>
      <p className="text-xs text-muted">{t("agentTabHint")}</p>
      <RestoredNotice data={data} />
      {shown ? (
        <DefinitionGraph
          def={shown}
          ports={data.ports}
          problems={data.problems}
          height={open ? 260 : 340}
          selected={openNode?.id ?? null}
          onNodeClick={(id) => {
            if (id) select(id);
            else if (open) select(open);
          }}
        />
      ) : null}
      {owned.size > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 text-xs text-muted"
          data-testid="wf-session-owned"
        >
          <Lock className="size-3" aria-hidden />
          <span>{t("agentOwned")} :</span>
          {[...owned].map((id) => (
            <button
              key={id}
              type="button"
              className="cursor-pointer rounded-full bg-surface-raised px-2 font-mono leading-5 text-content"
              onClick={() => select(id)}
            >
              {id}
            </button>
          ))}
        </div>
      )}
      {open === WORKFLOW_PART && shown && (
        <EditPanel
          title={t("agentWorkflowSettings")}
          owned={data.ownerWorkflow}
          onRelease={() => release(WORKFLOW_PART)}
          onClose={() => select(WORKFLOW_PART)}
          testId="wf-session-settings-panel"
        >
          <WorkflowSettings
            def={shown}
            readOnly={false}
            onChange={(d) =>
              wfEdit.change(WORKFLOW_PART, {
                name: d.name,
                description: d.description,
                settings: d.settings,
              })
            }
          />
        </EditPanel>
      )}
      {open && open !== WORKFLOW_PART && (
        <EditPanel
          title={t("agentEditNode", { id: open })}
          owned={owned.has(open)}
          onRelease={() => release(open)}
          onClose={() => select(open)}
          testId="wf-session-node-panel"
        >
          {openNode ? (
            <NodeInspector
              node={openNode}
              readOnly={false}
              commands={commands}
              problems={data.problems
                .filter((p) => p.node === openNode.id)
                .map((p) => p.message)}
              onChange={(n) => nodeEdit.change(n.id, n)}
            />
          ) : (
            <p className="text-sm text-muted">{t("agentNodeGone")}</p>
          )}
        </EditPanel>
      )}
      {data.problems.length > 0 && (
        <ul
          className="flex flex-col gap-1 text-sm text-danger"
          data-testid="wf-session-problems"
        >
          {data.problems.slice(0, 12).map((p, i) => (
            <li key={i}>
              {p.node ? `${p.node} : ` : ""}
              {p.message}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        {!target && (
          <Field
            label={t("wfIdLabel")}
            hint={t("wfIdRule")}
            className="min-w-48 flex-1"
          >
            <input
              className={fieldClassName}
              value={newId}
              onChange={(e) => setNewId(e.target.value.trim())}
              data-testid="wf-session-id"
            />
          </Field>
        )}
        <Button
          type="button"
          variant="primary"
          testId="wf-session-save"
          isDisabled={
            !data.ok ||
            editing ||
            save.isPending ||
            (!target && !ID_RE.test(newId))
          }
          startContent={<Save className="size-4" aria-hidden />}
          onClick={doSave}
        >
          {target ? t("agentSaveVersion") : t("agentSaveNew")}
        </Button>
      </div>
      {saved && (
        <Notice tone="success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("agentSaved", { id: saved.id, v: saved.version })}</span>
        </Notice>
      )}
    </div>
  );
}
