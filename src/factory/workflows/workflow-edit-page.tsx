/**
 * Workflow editor (/factory/workflows/:id/edit): the graph editor full width, under
 * the same header as the workflow's page (back to it). `?node=<id>` selects a node,
 * `?scope=template` edits a template of the library.
 */
import React from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  TEMPLATE_SCOPE,
  scopeKey,
  useProjects,
  useWorkflow,
  type WorkflowScope,
} from "../api";
import { useFactoryT } from "../i18n";
import { useSelectedProject } from "../project-context";
import { DetailHeader, Pill, StateMessage } from "../ui";
import { Editor } from "./editor";
import { workflowPath } from "./workflow-list-page";

export default function WorkflowEditPage() {
  const t = useFactoryT();
  const navigate = useNavigate();
  const { workflowId = "" } = useParams();
  const [params] = useSearchParams();
  const { isLoading: projectsLoading } = useProjects();
  const { projectId, project } = useSelectedProject();
  const scope = React.useMemo<WorkflowScope>(
    () =>
      params.get("scope") === "template" || !projectId
        ? TEMPLATE_SCOPE
        : { kind: "project", project: projectId },
    [params, projectId],
  );
  const { data } = useWorkflow(projectsLoading ? null : scope, workflowId);
  return (
    <ReactFlowProvider>
      <div
        className="flex h-full min-h-0 flex-col bg-canvas-base"
        data-testid="factory-workflows-page"
      >
        <DetailHeader
          title={data?.workflow.name ?? workflowId}
          backTo={workflowPath(scope, workflowId)}
          testId="wf-edit-header"
          badge={
            <Pill testId="wf-scope">
              {scope.kind === "project"
                ? t("projectWorkflows", { p: project?.name ?? projectId })
                : t("templates")}
            </Pill>
          }
        />
        <div className="flex min-h-0 flex-1">
          {projectsLoading ? (
            <div className="flex-1 px-5">
              <StateMessage kind="loading" />
            </div>
          ) : (
            <Editor
              key={`${scopeKey(scope)}:${workflowId}`}
              scope={scope}
              workflowId={workflowId}
              initialNode={params.get("node")}
              commands={project?.commands ?? []}
              onOpen={(id) => navigate(workflowPath(scope, id, "/edit"))}
            />
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
