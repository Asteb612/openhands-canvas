/**
 * Right-hand forms of the editor: the selected node (common fields, its type's form,
 * options, raw JSON) or, with nothing selected, the workflow's own settings.
 */
import React from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "#/utils/utils";
import type { WorkflowDefinition, WorkflowNode } from "../api";
import { useFactoryT } from "../i18n";
import { Field, Notice, fieldClassName, textActionClassName } from "../ui";
import {
  Area,
  Check,
  ID_RE,
  JsonConfig,
  Num,
  Select,
  Text,
  type SetConfig,
} from "./inspector-fields";
import { TypeForm } from "./node-forms";

export function NodeInspector({
  node,
  readOnly,
  commands,
  problems,
  onChange,
  onRename,
  onDelete,
}: {
  node: WorkflowNode;
  readOnly: boolean;
  commands: string[];
  problems: string[];
  onChange: (n: WorkflowNode) => void;
  /** Without it, the id is fixed (a draft node edited by hand). */
  onRename?: (newId: string) => void;
  /** Without it, the node cannot be deleted here. */
  onDelete?: () => void;
}) {
  const t = useFactoryT();
  const [idDraft, setIdDraft] = React.useState(node.id);
  const jsonByDefault = node.type === "check" || node.type === "router";
  const [advanced, setAdvanced] = React.useState(jsonByDefault);
  React.useEffect(() => {
    setIdDraft(node.id);
    setAdvanced(node.type === "check" || node.type === "router");
  }, [node.id, node.type]);
  const set: SetConfig = (patch) => {
    const config = { ...node.config, ...patch };
    for (const k of Object.keys(config))
      if (config[k] === undefined) delete config[k];
    onChange({ ...node, config });
  };
  const setBase = (patch: Partial<WorkflowNode>) => {
    const n = { ...node, ...patch } as Record<string, unknown>;
    for (const k of Object.keys(n)) if (n[k] === undefined) delete n[k];
    onChange(n as unknown as WorkflowNode);
  };
  const idValid = ID_RE.test(idDraft);
  const Chevron = advanced ? ChevronDown : ChevronRight;
  return (
    <div className="flex flex-col gap-4" data-testid="wf-inspector">
      {problems.length > 0 && (
        <Notice tone="danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <ul className="flex flex-col gap-0.5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Notice>
      )}
      <Field label={t("wfNodeId")} hint={idValid ? undefined : t("wfIdRule")}>
        <input
          className={cn(
            fieldClassName,
            "font-mono",
            !idValid && "border-danger",
          )}
          value={idDraft}
          disabled={readOnly || !onRename}
          data-testid="wf-node-id"
          onChange={(e) => setIdDraft(e.target.value)}
          onBlur={() => {
            if (idDraft !== node.id && idValid && onRename) onRename(idDraft);
            else setIdDraft(node.id);
          }}
        />
      </Field>
      <Field label={t("wfNodeLabel")}>
        <Text
          value={node.label}
          disabled={readOnly}
          onChange={(v) => setBase({ label: v || undefined })}
        />
      </Field>
      <TypeForm node={node} set={set} ro={readOnly} commands={commands} />
      <details className="group flex flex-col">
        <summary className={cn(textActionClassName, "flex items-center gap-1")}>
          <ChevronRight
            className="size-3.5 transition-transform group-open:rotate-90"
            aria-hidden
          />
          {t("wfNodeOptions")}
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <Field label={t("wfMaxVisits")} hint={t("wfMaxVisitsHint")}>
            <Num
              value={node.maxVisits}
              min={1}
              max={20}
              disabled={readOnly}
              onChange={(maxVisits) => setBase({ maxVisits })}
            />
          </Field>
          <Field label={t("wfTimeout")} hint={t("wfTimeoutHint")}>
            <Num
              value={node.timeoutMinutes}
              min={1}
              disabled={readOnly}
              onChange={(timeoutMinutes) => setBase({ timeoutMinutes })}
            />
          </Field>
          <Field label={t("wfBoard")}>
            <Text
              value={node.board}
              disabled={readOnly}
              onChange={(v) => setBase({ board: v || undefined })}
            />
          </Field>
        </div>
      </details>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className={cn(
            textActionClassName,
            "flex items-center gap-1 self-start",
          )}
          aria-expanded={advanced}
          onClick={() => setAdvanced((a) => !a)}
        >
          <Chevron className="size-3.5" aria-hidden />
          {t("wfJsonConfig")}
        </button>
        {advanced && (
          <JsonConfig
            value={node.config}
            disabled={readOnly}
            onChange={(config) => onChange({ ...node, config })}
          />
        )}
      </div>
      {!readOnly && onDelete && (
        <button
          type="button"
          className={cn(
            textActionClassName,
            "inline-flex items-center gap-1 self-start text-danger",
          )}
          onClick={onDelete}
          data-testid="wf-delete-node"
        >
          <Trash2 className="size-3.5" aria-hidden />
          {t("wfDeleteNode")}
        </button>
      )}
    </div>
  );
}

export function WorkflowSettings({
  def,
  readOnly,
  onChange,
}: {
  def: WorkflowDefinition;
  readOnly: boolean;
  onChange: (d: WorkflowDefinition) => void;
}) {
  const t = useFactoryT();
  const s = def.settings;
  const setS = (patch: Partial<WorkflowDefinition["settings"]>) =>
    onChange({ ...def, settings: { ...s, ...patch } });
  return (
    <div className="flex flex-col gap-4" data-testid="wf-settings">
      <Field label={t("wfName")}>
        <Text
          value={def.name}
          disabled={readOnly}
          testId="wf-name"
          onChange={(name) => onChange({ ...def, name })}
        />
      </Field>
      <Field label={t("wfDescription")}>
        <Area
          value={def.description}
          rows={3}
          disabled={readOnly}
          onChange={(description) => onChange({ ...def, description })}
        />
      </Field>
      <Field label={t("wfOnExisting")}>
        <Select
          value={s.onExisting}
          disabled={readOnly}
          options={[
            ["ignore", t("wfOnExistingIgnore")],
            ["restart", t("wfOnExistingRestart")],
          ]}
          onChange={(v) => setS({ onExisting: v as "ignore" | "restart" })}
        />
      </Field>
      <Check
        label={t("wfCancelOnLabelRemoved")}
        checked={s.cancelOnLabelRemoved}
        disabled={readOnly}
        onChange={(v) => setS({ cancelOnLabelRemoved: v })}
      />
      <Check
        label={t("wfCancelOnIssueClosed")}
        checked={s.cancelOnIssueClosed}
        disabled={readOnly}
        onChange={(v) => setS({ cancelOnIssueClosed: v })}
      />
      <Check
        label={t("wfSpeckit")}
        checked={s.speckit}
        disabled={readOnly}
        onChange={(v) => setS({ speckit: v })}
      />
      <p className="text-xs text-muted">{t("wfEditorHelp")}</p>
    </div>
  );
}
