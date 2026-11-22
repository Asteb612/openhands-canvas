/**
 * A workflow's page (/factory/workflows/:id), laid out like an automation's page:
 * what starts it, then its steps, its settings, and its recent runs.
 */
import React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  Activity,
  CalendarClock,
  ExternalLink,
  GitBranch,
  History,
  ListTree,
  Pencil,
  Play,
  Settings2,
  Sparkles,
  Zap,
} from "lucide-react";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import {
  TEMPLATE_SCOPE,
  reportFactoryError,
  useRunNow,
  useRuns,
  useWorkflow,
  type TriggerSummary,
  type WorkflowScope,
} from "../api";
import {
  useDescribeTrigger,
  useFormatDateTime,
  useRunSubject,
} from "../describe";
import { activityLine, since } from "../format";
import { useFactoryT, type FactoryKey } from "../i18n";
import { conversationPath, useSelectedProject } from "../project-context";
import { RunStateChip } from "../run-status";
import { isTerminal } from "../states";
import {
  ActivityList,
  ActivityRow,
  Button,
  ConfigField,
  DetailHeader,
  KebabMenu,
  Notice,
  Pill,
  SectionCard,
  SectionConnector,
  StateMessage,
  textActionClassName,
} from "../ui";
import { AgentWorkflowDialog } from "./agent-dialog";
import { useWorkflowActions } from "./workflow-actions";
import { WorkflowPreview } from "./workflow-preview";
import { workflowPath } from "./workflow-list-page";

const TRIGGER_KIND: Record<TriggerSummary["kind"], FactoryKey> = {
  label: "trgKind_label",
  project_status: "trgKind_project_status",
  comment_command: "trgKind_comment_command",
  manual: "trgKind_manual",
  cron: "trgKind_cron",
  schedule: "trgKind_schedule",
  chain: "trgKind_chain",
};

export default function WorkflowDetailPage() {
  const t = useFactoryT();
  const navigate = useNavigate();
  const { workflowId = "" } = useParams();
  const [params] = useSearchParams();
  const { projectId, project } = useSelectedProject();
  const scope = React.useMemo<WorkflowScope>(
    () =>
      params.get("scope") === "template" || !projectId
        ? TEMPLATE_SCOPE
        : { kind: "project", project: projectId },
    [params, projectId],
  );
  const { data, error, isLoading } = useWorkflow(scope, workflowId);
  const runNow = useRunNow();
  const [agentOpen, setAgentOpen] = React.useState(false);
  const describe = useDescribeTrigger();
  const fmt = useFormatDateTime();
  const subject = useRunSubject();
  const { data: runs } = useRuns(
    scope.kind === "project" ? scope.project : undefined,
  );
  const backTo =
    scope.kind === "template"
      ? "/factory/workflows?scope=template"
      : "/factory/workflows";

  const summary = data?.workflow;
  const actions = useWorkflowActions({
    scope,
    summary: summary ?? {
      scope: "",
      id: workflowId,
      name: workflowId,
      description: "",
      builtin: false,
      archived: false,
      latestVersion: 0,
      updatedAt: "",
    },
    dirty: false,
    onOpen: (id) => navigate(workflowPath(scope, id)),
  });

  if (error || isLoading || !data || !summary)
    return (
      <div className="flex h-full flex-col bg-canvas-base">
        <DetailHeader title={workflowId} backTo={backTo} />
        <div className="automation-setup-content mx-auto w-full px-5 py-5">
          {error ? (
            <StateMessage kind="error">
              {t("wfLoadError", { id: workflowId, msg: error.message })}
            </StateMessage>
          ) : (
            <StateMessage kind="loading" />
          )}
        </div>
      </div>
    );

  const def = data.definition;
  const enabled =
    scope.kind === "project"
      ? (project?.enabledWorkflows.includes(workflowId) ?? false)
      : null;
  const triggers = summary.triggers ?? [];
  const mine = (runs ?? [])
    .filter((r) => r.workflow === workflowId)
    .slice(0, 10);
  const run = () =>
    runNow.mutate(
      { project: projectId, id: workflowId },
      {
        onSuccess: (r) =>
          displaySuccessToast(
            t("runStarted", { id: r.runId, name: summary.name }),
          ),
        onError: reportFactoryError,
      },
    );

  return (
    <div
      className="flex h-full flex-col bg-canvas-base"
      data-testid="wf-detail"
    >
      <DetailHeader
        title={summary.name}
        backTo={backTo}
        testId="wf-detail-header"
        badge={
          <>
            {enabled !== null && (
              <Pill
                tone={enabled ? "success" : "neutral"}
                testId="wf-detail-enabled"
              >
                {enabled ? t("enabled") : t("disabled")}
              </Pill>
            )}
            {summary.scheduled && (
              <Pill icon={<CalendarClock className="size-3" aria-hidden />}>
                {t("scheduled")}
              </Pill>
            )}
            {scope.kind === "template" && <Pill>{t("templates")}</Pill>}
          </>
        }
      >
        {summary.scheduled && enabled && (
          <Button
            type="button"
            variant="secondary"
            testId="wf-detail-run-now"
            isDisabled={runNow.isPending}
            startContent={<Play className="size-4" aria-hidden />}
            onClick={run}
          >
            {t("runNow")}
          </Button>
        )}
        {projectId && (
          <Button
            type="button"
            variant="secondary"
            testId="wf-detail-agent"
            startContent={<Sparkles className="size-4" aria-hidden />}
            onClick={() => setAgentOpen(true)}
          >
            {t("agentEdit")}
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          testId="wf-detail-edit"
          startContent={<Pencil className="size-4" aria-hidden />}
          onClick={() => navigate(workflowPath(scope, workflowId, "/edit"))}
        >
          {t("edit")}
        </Button>
        <KebabMenu items={actions.items} />
      </DetailHeader>
      <div className="custom-scrollbar-always min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="automation-setup-content mx-auto flex w-full flex-col gap-4">
          {def.description && (
            <p className="text-sm text-muted">{def.description}</p>
          )}
          {summary.templateUpdate && (
            <Notice tone="info">
              {t("templateUpdateNotice", {
                t: summary.templateUpdate.templateId,
                v: summary.templateUpdate.to,
              })}
            </Notice>
          )}
          {enabled === false && (
            <Notice tone="warning">
              <span>
                {t("wfDisabledNotice")}{" "}
                <Link to="/factory/project" className={textActionClassName}>
                  {t("navProject")}
                </Link>
              </span>
            </Notice>
          )}

          <SectionCard
            icon={<Zap className="size-4" aria-hidden />}
            title={t("trigger")}
            meta={summary.scheduled ? t("noIssue") : t("onIssue")}
            testId="wf-detail-trigger"
          >
            <div className="flex flex-col gap-4">
              {triggers.length === 0 && (
                <p className="text-sm text-muted">{t("noTrigger")}</p>
              )}
              {triggers.map((tr, i) => (
                <ConfigField
                  key={i}
                  icon={
                    tr.kind === "schedule" || tr.kind === "cron" ? (
                      <CalendarClock className="size-3.5" aria-hidden />
                    ) : (
                      <Zap className="size-3.5" aria-hidden />
                    )
                  }
                  label={t(TRIGGER_KIND[tr.kind])}
                >
                  {describe(tr)}
                </ConfigField>
              ))}
              {summary.scheduled && summary.nextRunAt && (
                <ConfigField
                  icon={<History className="size-3.5" aria-hidden />}
                  label={t("nextRunLabel")}
                >
                  {enabled === false
                    ? t("notWhileDisabled")
                    : fmt(summary.nextRunAt)}
                </ConfigField>
              )}
            </div>
          </SectionCard>
          <SectionConnector />
          <SectionCard
            icon={<ListTree className="size-4" aria-hidden />}
            title={t("steps")}
            meta={t("stepsCount", {
              n: def.nodes.filter((n) => n.type !== "trigger").length,
              v: summary.latestVersion,
            })}
            testId="wf-detail-steps"
          >
            <WorkflowPreview
              scope={scope}
              workflowId={workflowId}
              version={summary.latestVersion}
              currentNode={null}
              height={320}
            />
          </SectionCard>
          <SectionCard
            icon={<Settings2 className="size-4" aria-hidden />}
            title={t("settings")}
            testId="wf-detail-settings"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ConfigField
                icon={<GitBranch className="size-3.5" aria-hidden />}
                label={t("onExistingLabel")}
              >
                {def.settings.onExisting === "restart"
                  ? t("onExistingRestart")
                  : t("onExistingIgnore")}
              </ConfigField>
              {!summary.scheduled && (
                <ConfigField
                  icon={<Settings2 className="size-3.5" aria-hidden />}
                  label={t("cancelRules")}
                >
                  {[
                    def.settings.cancelOnIssueClosed
                      ? t("cancelOnClosed")
                      : null,
                    def.settings.cancelOnLabelRemoved
                      ? t("cancelOnLabel")
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || t("none")}
                </ConfigField>
              )}
              <ConfigField
                icon={<History className="size-3.5" aria-hidden />}
                label={t("versions")}
              >
                {data.versions.slice(0, 3).map((v) => (
                  <div key={v.version} className="truncate text-sm">
                    {t("versionLine", {
                      v: v.version,
                      when: since(t, v.createdAt),
                      by: v.createdBy,
                      comment: v.comment ? ` — ${v.comment}` : "",
                    })}
                  </div>
                ))}
              </ConfigField>
            </div>
          </SectionCard>
          {scope.kind === "project" && (
            <SectionCard
              icon={<Activity className="size-4" aria-hidden />}
              title={t("activity")}
              meta={
                summary.activity ? activityLine(t, summary.activity) : undefined
              }
              testId="wf-detail-activity"
            >
              {mine.length === 0 ? (
                <p className="text-sm text-muted">{t("noRunsYet")}</p>
              ) : (
                <ActivityList>
                  {mine.map((r) => (
                    <ActivityRow key={r.id} testId={`wf-detail-run-${r.id}`}>
                      <RunStateChip state={r.state} />
                      <span className="min-w-0 flex-1 truncate text-sm text-content">
                        {subject(r)} {r.kind === "scheduled" ? "" : r.title}
                        {!isTerminal(r.state) && r.nodeLabel ? (
                          <span className="text-muted"> · {r.nodeLabel}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {since(t, r.createdAt ?? r.updatedAt)}
                      </span>
                      {r.conversationId && (
                        <Link
                          to={conversationPath(r.project, r.conversationId)}
                          className={`${textActionClassName} inline-flex shrink-0 items-center gap-1`}
                        >
                          <ExternalLink className="size-3.5" aria-hidden />
                          {t("conversation")}
                        </Link>
                      )}
                    </ActivityRow>
                  ))}
                </ActivityList>
              )}
            </SectionCard>
          )}
        </div>
      </div>
      {actions.dialogs}
      {agentOpen && projectId && (
        <AgentWorkflowDialog
          project={projectId}
          scope={scope.kind}
          workflow={summary}
          onClose={() => setAgentOpen(false)}
        />
      )}
    </div>
  );
}
