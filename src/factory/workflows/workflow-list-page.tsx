/**
 * Workflows (/factory/workflows), in the automations look: the active project's
 * workflows (or the template library) as cards, then the templates to start from.
 * Old deep links `?wf=<id>&node=<node>` go to that workflow's editor.
 */
import React from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { CopyPlus, LayoutTemplate, Plus } from "lucide-react";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import {
  TEMPLATE_SCOPE,
  reportFactoryError,
  useCreateFromTemplate,
  useProjects,
  useRunNow,
  useSaveWorkflow,
  useWorkflows,
  type WorkflowScope,
  type WorkflowSummary,
} from "../api";
import { useFactoryT } from "../i18n";
import { useSelectedProject } from "../project-context";
import {
  Button,
  CardDescription,
  CardGrid,
  CardHeader,
  CardPill,
  EmptyPanel,
  FactoryCard,
  FactoryShell,
  PageHeading,
  StateMessage,
  SubHeading,
  Switch,
} from "../ui";
import { blankDefinition } from "./defaults";
import { IdDialog } from "./id-dialog";
import { WorkflowCard } from "./workflow-card";

/** Link to a workflow's page (`?scope=template` for the library). */
export function workflowPath(
  scope: WorkflowScope,
  id: string,
  sub: "" | "/edit" = "",
  extra?: Record<string, string>,
): string {
  const q = new URLSearchParams(extra);
  if (scope.kind === "template") q.set("scope", "template");
  const qs = q.toString();
  return `/factory/workflows/${encodeURIComponent(id)}${sub}${qs ? `?${qs}` : ""}`;
}

type Tab = "project" | "template";

export default function WorkflowListPage() {
  const t = useFactoryT();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isLoading: projectsLoading } = useProjects();
  const { projectId, project } = useSelectedProject();
  const tab: Tab =
    params.get("scope") === "template" || !projectId ? "template" : "project";
  const scope = React.useMemo<WorkflowScope>(
    () =>
      tab === "project" && projectId
        ? { kind: "project", project: projectId }
        : TEMPLATE_SCOPE,
    [tab, projectId],
  );
  const [showArchived, setShowArchived] = React.useState(false);
  const [dialog, setDialog] = React.useState<
    { kind: "new" } | { kind: "fromTemplate"; template?: string } | null
  >(null);
  const ready = !projectsLoading;
  const {
    data: workflows,
    error,
    isLoading,
  } = useWorkflows(ready ? scope : null, showArchived);
  const { data: allIds } = useWorkflows(dialog ? scope : null, true);
  const { data: templates } = useWorkflows(
    tab === "project" ? TEMPLATE_SCOPE : null,
  );
  const save = useSaveWorkflow();
  const createFromTemplate = useCreateFromTemplate();
  const runNow = useRunNow();

  // Old deep link (banner, notifications): straight to the editor.
  const legacy = params.get("wf");
  if (legacy) {
    const node = params.get("node");
    return (
      <Navigate
        replace
        to={workflowPath(
          params.get("scope") === "template"
            ? TEMPLATE_SCOPE
            : projectId
              ? { kind: "project", project: projectId }
              : TEMPLATE_SCOPE,
          legacy,
          "/edit",
          node ? { node } : undefined,
        )}
      />
    );
  }

  const setTab = (next: Tab) => {
    const q = new URLSearchParams(params);
    if (next === "template") q.set("scope", "template");
    else q.delete("scope");
    setParams(q, { replace: true });
  };
  const open = (id: string) => navigate(workflowPath(scope, id));
  const run = (w: WorkflowSummary) =>
    runNow.mutate(
      { project: projectId, id: w.id },
      {
        onSuccess: (r) =>
          displaySuccessToast(t("runStarted", { id: r.runId, name: w.name })),
        onError: reportFactoryError,
      },
    );
  const projectWfIds = new Set(
    (workflows ?? []).map((w) => w.source?.split("@")[0]),
  );
  const suggestions =
    tab === "project" ? (templates ?? []).filter((x) => !x.archived) : [];

  return (
    <FactoryShell>
      <PageHeading
        title={t("navWorkflows")}
        description={
          tab === "project"
            ? t("wfListHintProject", { p: project?.name ?? projectId })
            : t("wfListHintTemplates")
        }
        actions={
          <>
            {tab === "project" && (
              <Button
                type="button"
                variant="secondary"
                testId="wf-create-from-template"
                startContent={<CopyPlus className="size-4" aria-hidden />}
                onClick={() => setDialog({ kind: "fromTemplate" })}
              >
                {t("createFromTemplate")}
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              testId="wf-new"
              startContent={<Plus className="size-4" aria-hidden />}
              onClick={() => setDialog({ kind: "new" })}
            >
              {tab === "project" ? t("wfNewWorkflow") : t("wfNewTemplate")}
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex gap-1"
          role="tablist"
          aria-label={t("navWorkflows")}
        >
          {projectId && (
            <ScopeChip
              active={tab === "project"}
              onClick={() => setTab("project")}
              testId="wf-tab-project"
            >
              {t("projectWorkflows", { p: project?.name ?? projectId })}
            </ScopeChip>
          )}
          <ScopeChip
            active={tab === "template"}
            onClick={() => setTab("template")}
            testId="wf-tab-template"
          >
            {t("templates")}
          </ScopeChip>
        </div>
        <Switch
          testId="wf-show-archived"
          isToggled={showArchived}
          onToggle={setShowArchived}
        >
          {t("wfShowArchived")}
        </Switch>
      </div>
      {(!ready || isLoading) && <StateMessage kind="loading" />}
      {error && <StateMessage kind="error">{error.message}</StateMessage>}
      {workflows?.length === 0 && (
        <EmptyPanel title={t("wfNoWorkflows")}>{t("wfEmptyHint")}</EmptyPanel>
      )}
      {workflows && workflows.length > 0 && (
        <CardGrid>
          {workflows.map((w) => {
            const enabled =
              scope.kind === "project"
                ? (project?.enabledWorkflows.includes(w.id) ?? false)
                : null;
            return (
              <WorkflowCard
                key={w.id}
                w={w}
                enabled={enabled}
                isDefault={
                  enabled !== null && project?.defaultWorkflow === w.id
                }
                onOpen={() => open(w.id)}
                onRunNow={w.scheduled && enabled ? () => run(w) : undefined}
                running={runNow.isPending && runNow.variables?.id === w.id}
              />
            );
          })}
        </CardGrid>
      )}
      {suggestions.length > 0 && (
        <section
          className="flex flex-col gap-3"
          data-testid="wf-template-launcher"
        >
          <SubHeading meta={t("wfLauncherHint")}>
            {t("startFromTemplate")}
          </SubHeading>
          <CardGrid>
            {suggestions.map((tpl) => (
              <FactoryCard
                key={tpl.id}
                testId={`wf-template-card-${tpl.id}`}
                onOpen={() =>
                  setDialog({ kind: "fromTemplate", template: tpl.id })
                }
              >
                <CardHeader
                  title={tpl.name}
                  badges={
                    projectWfIds.has(tpl.id) ? (
                      <CardPill>{t("alreadyUsed")}</CardPill>
                    ) : null
                  }
                />
                {tpl.description && (
                  <CardDescription>{tpl.description}</CardDescription>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <CardPill
                    icon={<LayoutTemplate className="size-3" aria-hidden />}
                  >
                    {tpl.scheduled
                      ? t("scheduledTemplate")
                      : t("issueTemplate")}
                  </CardPill>
                </div>
              </FactoryCard>
            ))}
          </CardGrid>
        </section>
      )}
      {dialog?.kind === "new" && (
        <IdDialog
          title={
            scope.kind === "project" ? t("wfNewWorkflow") : t("wfNewTemplate")
          }
          submitLabel={t("wfCreate")}
          takenIds={(allIds ?? []).map((w) => w.id)}
          busy={save.isPending}
          onClose={() => setDialog(null)}
          onSubmit={({ id }) =>
            save.mutate(
              {
                scope,
                id,
                definition: blankDefinition(id),
                comment: t("wfCreatedComment"),
              },
              {
                onSuccess: () => {
                  setDialog(null);
                  navigate(workflowPath(scope, id, "/edit"));
                },
                onError: reportFactoryError,
              },
            )
          }
        />
      )}
      {dialog?.kind === "fromTemplate" && scope.kind === "project" && (
        <IdDialog
          title={t("createFromTemplate")}
          description={t("wfFromTemplateHint", {
            p: project?.name ?? projectId,
          })}
          submitLabel={t("wfCreate")}
          takenIds={(allIds ?? []).map((w) => w.id)}
          templates={templates ?? []}
          initialTemplate={dialog.template}
          busy={createFromTemplate.isPending}
          onClose={() => setDialog(null)}
          onSubmit={({ id, template }) =>
            createFromTemplate.mutate(
              { project: scope.project, fromTemplate: template, id },
              {
                onSuccess: (r) => {
                  setDialog(null);
                  displaySuccessToast(
                    t("wfCreatedFrom", { id: r.id, t: template }),
                  );
                  navigate(workflowPath(scope, r.id));
                },
                onError: reportFactoryError,
              },
            )
          }
        />
      )}
    </FactoryShell>
  );
}

function ScopeChip({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      className={
        active
          ? "cursor-pointer rounded-full bg-surface-raised px-3 py-1 text-sm text-content"
          : "cursor-pointer rounded-full px-3 py-1 text-sm text-muted hover:text-content"
      }
    >
      {children}
    </button>
  );
}
