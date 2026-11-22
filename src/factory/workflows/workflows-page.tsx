/**
 * Workflow editor page (/factory/workflows). Workflows live in a scope: the active
 * project's own workflows, or the shared template library. Deep link:
 * `?wf=<id>&node=<node>` (project scope when a project is active) and
 * `&scope=template` for a template.
 */
import React from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useSearchParams } from "react-router";
import { CopyPlus, FolderKanban, LayoutTemplate, Plus } from "lucide-react";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import {
  TEMPLATE_SCOPE,
  reportFactoryError,
  scopeKey,
  useCreateFromTemplate,
  useProjects,
  useSaveWorkflow,
  useWorkflows,
  type WorkflowScope,
} from "../api";
import { useFactoryT } from "../i18n";
import { useSelectedProject } from "../project-context";
import { Button, FactoryPage, Pill, StateMessage } from "../ui";
import { blankDefinition } from "./defaults";
import { Editor } from "./editor";
import { IdDialog } from "./id-dialog";
import { WorkflowList, type ScopeTab } from "./workflow-list";

type Dialog = "new" | "fromTemplate" | null;

/** Selection of the page, mirrored into the URL (shareable, back to it after reload). */
function useSelection(projectId: string) {
  const [params, setParams] = useSearchParams();
  const initial = React.useRef({
    wf: params.get("wf"),
    node: params.get("node"),
    tab: (params.get("scope") === "template"
      ? "template"
      : "project") as ScopeTab,
  });
  const [tab, setTab] = React.useState<ScopeTab>(initial.current.tab);
  const [selected, setSelected] = React.useState<string | null>(
    initial.current.wf,
  );
  // The deep-linked node applies once, to the deep-linked workflow.
  const [initialNode, setInitialNode] = React.useState(initial.current.node);
  const effectiveTab: ScopeTab = projectId ? tab : "template";

  // Another project picked in the sidebar: its workflows are other ones.
  const previousProject = React.useRef(projectId);
  React.useEffect(() => {
    if (previousProject.current === projectId) return;
    if (previousProject.current && tab === "project") {
      setSelected(null);
      setInitialNode(null);
    }
    previousProject.current = projectId;
  }, [projectId, tab]);

  React.useEffect(() => {
    if (!selected) return;
    const next = new URLSearchParams(params);
    next.set("wf", selected);
    if (effectiveTab === "template") next.set("scope", "template");
    else next.delete("scope");
    if (!initialNode) next.delete("node");
    if (next.toString() !== params.toString())
      setParams(next, { replace: true });
  }, [selected, effectiveTab, initialNode, params, setParams]);

  const select = React.useCallback((id: string | null) => {
    setSelected(id);
    setInitialNode(null);
  }, []);
  const changeTab = React.useCallback(
    (next: ScopeTab) => {
      setTab(next);
      select(null);
    },
    [select],
  );
  return {
    tab: effectiveTab,
    setTab: changeTab,
    selected,
    select,
    initialNode,
  };
}

export default function WorkflowsPage() {
  const t = useFactoryT();
  const { isLoading: projectsLoading } = useProjects();
  const { projectId, project } = useSelectedProject();
  const { tab, setTab, selected, select, initialNode } =
    useSelection(projectId);
  const scope = React.useMemo<WorkflowScope>(
    () =>
      tab === "project" && projectId
        ? { kind: "project", project: projectId }
        : TEMPLATE_SCOPE,
    [tab, projectId],
  );
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const save = useSaveWorkflow();
  const createFromTemplate = useCreateFromTemplate();

  // Wait for the projects: the default scope depends on the active project.
  const ready = !projectsLoading;
  const { data: workflows } = useWorkflows(ready ? scope : null);
  // Archived ones included: their ids stay taken.
  const { data: allIds } = useWorkflows(dialog ? scope : null, true);
  const { data: templates } = useWorkflows(
    dialog === "fromTemplate" ? TEMPLATE_SCOPE : null,
  );

  // Nothing selected: the project's default workflow, else the first one.
  React.useEffect(() => {
    if (selected || !workflows?.length) return;
    const preferred =
      scope.kind === "project" ? project?.defaultWorkflow : null;
    select(workflows.find((w) => w.id === preferred)?.id ?? workflows[0]!.id);
  }, [selected, workflows, scope.kind, project?.defaultWorkflow, select]);

  const takenIds = (allIds ?? []).map((w) => w.id);
  const projectName = project ? project.name : null;

  return (
    <ReactFlowProvider>
      <FactoryPage
        width="full"
        testId="factory-workflows-page"
        title={t("navWorkflows")}
        badge={
          scope.kind === "project" ? (
            <Pill
              icon={<FolderKanban className="size-3" aria-hidden />}
              testId="wf-scope"
            >
              {t("projectWorkflows", { p: projectName ?? projectId })}
            </Pill>
          ) : (
            <Pill
              icon={<LayoutTemplate className="size-3" aria-hidden />}
              testId="wf-scope"
            >
              {t("templates")}
            </Pill>
          )
        }
        actions={
          <>
            {scope.kind === "project" && (
              <Button
                type="button"
                variant="secondary"
                testId="wf-create-from-template"
                startContent={<CopyPlus className="size-4" aria-hidden />}
                onClick={() => setDialog("fromTemplate")}
              >
                {t("createFromTemplate")}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              testId="wf-new"
              startContent={<Plus className="size-4" aria-hidden />}
              onClick={() => setDialog("new")}
            >
              {scope.kind === "project"
                ? t("wfNewWorkflow")
                : t("wfNewTemplate")}
            </Button>
          </>
        }
      >
        {!ready ? (
          <div className="flex-1 px-5">
            <StateMessage kind="loading" />
          </div>
        ) : (
          <>
            <WorkflowList
              projectName={projectId ? (projectName ?? projectId) : null}
              tab={tab}
              onTab={setTab}
              scope={scope}
              selected={selected}
              onSelect={select}
            />
            {selected ? (
              <Editor
                key={`${scopeKey(scope)}:${selected}`}
                scope={scope}
                workflowId={selected}
                initialNode={initialNode}
                commands={project?.commands ?? []}
                onOpen={select}
              />
            ) : (
              <div className="flex-1 p-5">
                <StateMessage kind="empty">{t("wfSelect")}</StateMessage>
              </div>
            )}
          </>
        )}
      </FactoryPage>
      {dialog === "new" && (
        <IdDialog
          title={
            scope.kind === "project" ? t("wfNewWorkflow") : t("wfNewTemplate")
          }
          submitLabel={t("wfCreate")}
          takenIds={takenIds}
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
                  select(id);
                },
                onError: reportFactoryError,
              },
            )
          }
        />
      )}
      {dialog === "fromTemplate" && scope.kind === "project" && (
        <IdDialog
          title={t("createFromTemplate")}
          description={t("wfFromTemplateHint", { p: projectName ?? projectId })}
          submitLabel={t("wfCreate")}
          takenIds={takenIds}
          templates={templates ?? []}
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
                  select(r.id);
                },
                onError: reportFactoryError,
              },
            )
          }
        />
      )}
    </ReactFlowProvider>
  );
}
