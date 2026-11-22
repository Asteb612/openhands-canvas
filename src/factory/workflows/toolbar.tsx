/** Editor toolbar (version, validity, overlays, save) and the statistics summary. */
import React from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  History,
  LayoutGrid,
  Save,
} from "lucide-react";
import { cn } from "#/utils/utils";
import type { WorkflowScope, WorkflowStats } from "../api";
import { formatDuration } from "../format";
import { useFactoryT } from "../i18n";
import { stateLook } from "../states";
import { Button, Pill, fieldClassName, selectClassName } from "../ui";
import type { WorkflowEditorState } from "./use-workflow-editor";

export function EditorToolbar({
  scope,
  editor,
}: {
  scope: WorkflowScope;
  editor: WorkflowEditorState;
}) {
  const t = useFactoryT();
  const [comment, setComment] = React.useState("");
  const { def, summary, validation, readOnly, oldVersion, dirty } = editor;
  if (!def) return null;
  const save = () => editor.save(comment, () => setComment(""));
  let validity: React.ReactNode = <Pill>{t("wfValidating")}</Pill>;
  if (validation)
    validity = validation.ok ? (
      <Pill
        tone="success"
        icon={<CheckCircle2 className="size-3" aria-hidden />}
      >
        {t("wfValid")}
      </Pill>
    ) : (
      <Pill
        tone="danger"
        icon={<AlertTriangle className="size-3" aria-hidden />}
      >
        {t("wfProblems", { n: validation.problems.length })}
      </Pill>
    );
  const source = summary?.source?.split("@")[0];
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      <span className="text-sm font-medium text-content" data-testid="wf-title">
        {def.name}
      </span>
      <span className="font-mono text-xs text-muted">{summary?.id}</span>
      <select
        className={cn(selectClassName, "w-auto max-w-64")}
        value={editor.viewVersion ?? editor.baseVersion}
        data-testid="wf-version"
        aria-label={t("wfVersion")}
        onChange={(e) => void editor.selectVersion(Number(e.target.value))}
      >
        {editor.versions.map((v) => (
          <option key={v.version} value={v.version}>
            {t("wfVersionOption", { v: v.version, by: v.createdBy })}
            {v.comment ? ` · ${v.comment}` : ""}
          </option>
        ))}
      </select>
      <span data-testid="wf-validity">{validity}</span>
      {dirty && <Pill tone="warning">{t("modified")}</Pill>}
      {scope.kind === "template" && summary?.builtin && (
        <Pill testId="wf-builtin">
          {t("builtinTemplate")}
          {summary.customised ? ` · ${t("modified")}` : ""}
        </Pill>
      )}
      {scope.kind === "project" && source && (
        <Pill testId="wf-source">{t("fromTemplate", { t: source })}</Pill>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {scope.kind === "project" && (
          <Button
            type="button"
            variant={editor.showStats ? "tertiary" : "secondary"}
            testId="wf-stats-toggle"
            onClick={() => editor.setShowStats((v) => !v)}
            startContent={<BarChart3 className="size-4" aria-hidden />}
          >
            {t("statistics")}
          </Button>
        )}
        {!readOnly && (
          <Button
            type="button"
            variant="secondary"
            onClick={editor.relayout}
            startContent={<LayoutGrid className="size-4" aria-hidden />}
          >
            {t("wfAutoLayout")}
          </Button>
        )}
        {oldVersion && (
          <Button
            type="button"
            variant="secondary"
            onClick={save}
            isDisabled={editor.saving}
            testId="wf-restore"
            startContent={<History className="size-4" aria-hidden />}
          >
            {t("wfRestoreVersion")}
          </Button>
        )}
        {!readOnly && (
          <>
            <input
              className={cn(fieldClassName, "w-52")}
              placeholder={t("wfVersionComment")}
              aria-label={t("wfVersionComment")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              type="button"
              variant="primary"
              isDisabled={!dirty || editor.saving}
              onClick={save}
              testId="wf-save"
              startContent={<Save className="size-4" aria-hidden />}
            >
              {t("save")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function StatsSummary({
  project,
  stats,
}: {
  project: string;
  stats: WorkflowStats;
}) {
  const t = useFactoryT();
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-1.5 text-xs text-muted"
      data-testid="wf-stats-summary"
    >
      <span>{t("wfStatsRuns", { n: stats.runs, p: project })}</span>
      {Object.entries(stats.byState).map(([st, n]) => (
        <span key={st}>
          {t("wfStatsState", { state: t(stateLook(st).label), n })}
        </span>
      ))}
      <span>
        {t("wfStatsMedian", {
          d: formatDuration(t, stats.medianCompletedSeconds),
        })}
      </span>
      <span>{t("wfStatsLegend")}</span>
    </div>
  );
}
