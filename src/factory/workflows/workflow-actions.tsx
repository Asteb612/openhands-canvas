/**
 * Actions on the open workflow (side panel, nothing selected): duplicate, publish a
 * project's workflow as a template, reset a customised built-in template, archive.
 */
import React from "react";
import { Archive, ArchiveRestore, Copy, RotateCcw, Upload } from "lucide-react";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import {
  TEMPLATE_SCOPE,
  reportFactoryError,
  useArchiveWorkflow,
  useDuplicateWorkflow,
  usePublishWorkflow,
  useResetWorkflow,
  useWorkflows,
  type WorkflowScope,
  type WorkflowSummary,
} from "../api";
import { useFactoryT } from "../i18n";
import { Button, useConfirm } from "../ui";
import { IdDialog } from "./id-dialog";

export function WorkflowActions({
  scope,
  summary,
  dirty,
  onOpen,
}: {
  scope: WorkflowScope;
  summary: WorkflowSummary;
  dirty: boolean;
  /** Opens another workflow of the same scope (the new copy). */
  onOpen: (id: string) => void;
}) {
  const t = useFactoryT();
  const { ask, modal } = useConfirm();
  const [dialog, setDialog] = React.useState<"duplicate" | "publish" | null>(
    null,
  );
  const duplicate = useDuplicateWorkflow();
  const publish = usePublishWorkflow();
  const archive = useArchiveWorkflow();
  const reset = useResetWorkflow();
  // Archived ones included: an id stays taken.
  const { data: scopeIds } = useWorkflows(scope, true);
  const { data: templates } = useWorkflows(
    dialog === "publish" ? TEMPLATE_SCOPE : null,
    true,
  );
  const project = scope.kind === "project" ? scope.project : null;
  const id = summary.id;

  const resetTemplate = () =>
    ask(t("wfResetConfirm", { name: summary.name }), () =>
      reset.mutate(
        { scope, id },
        {
          onSuccess: (r) =>
            displaySuccessToast(t("wfResetDone", { v: r.version })),
          onError: reportFactoryError,
        },
      ),
    );

  return (
    <div
      className="flex flex-col gap-2 border-t border-border pt-4"
      data-testid="wf-actions"
    >
      <h3 className="mb-1 text-sm font-medium text-content">
        {t("wfActions")}
      </h3>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          testId="wf-duplicate"
          startContent={<Copy className="size-4" aria-hidden />}
          onClick={() => setDialog("duplicate")}
        >
          {t("wfDuplicate")}
        </Button>
        {project && (
          <Button
            type="button"
            variant="secondary"
            testId="wf-publish"
            isDisabled={dirty}
            startContent={<Upload className="size-4" aria-hidden />}
            onClick={() => setDialog("publish")}
          >
            {t("publishAsTemplate")}
          </Button>
        )}
        {scope.kind === "template" && summary.builtin && summary.customised && (
          <Button
            type="button"
            variant="secondary"
            testId="wf-reset"
            isDisabled={reset.isPending || dirty}
            startContent={<RotateCcw className="size-4" aria-hidden />}
            onClick={resetTemplate}
          >
            {t("resetTemplate")}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          testId="wf-archive"
          isDisabled={archive.isPending}
          startContent={
            summary.archived ? (
              <ArchiveRestore className="size-4" aria-hidden />
            ) : (
              <Archive className="size-4" aria-hidden />
            )
          }
          onClick={() =>
            archive.mutate(
              { scope, id, archived: !summary.archived },
              {
                onSuccess: () =>
                  displaySuccessToast(
                    t(summary.archived ? "wfUnarchived" : "wfArchived", { id }),
                  ),
                // e.g. a project's enabled workflow: the server says why.
                onError: reportFactoryError,
              },
            )
          }
        >
          {summary.archived ? t("wfUnarchive") : t("wfArchive")}
        </Button>
      </div>
      {dirty && <p className="text-xs text-muted">{t("wfSaveFirst")}</p>}
      {dialog === "duplicate" && (
        <IdDialog
          title={t("wfDuplicateTitle", { name: summary.name })}
          submitLabel={t("wfDuplicate")}
          takenIds={(scopeIds ?? []).map((w) => w.id)}
          busy={duplicate.isPending}
          onClose={() => setDialog(null)}
          onSubmit={({ id: newId }) =>
            duplicate.mutate(
              { scope, id, newId },
              {
                onSuccess: (r) => {
                  setDialog(null);
                  displaySuccessToast(t("wfDuplicated", { id: r.id }));
                  onOpen(r.id);
                },
                onError: reportFactoryError,
              },
            )
          }
        />
      )}
      {dialog === "publish" && project && (
        <IdDialog
          title={t("publishAsTemplate")}
          description={t("wfPublishHint")}
          submitLabel={t("wfPublish")}
          initialId={id}
          takenIds={[]}
          existing={{
            ids: (templates ?? []).map((w) => w.id),
            hint: (tid) => t("wfPublishOver", { id: tid }),
          }}
          busy={publish.isPending}
          onClose={() => setDialog(null)}
          onSubmit={({ id: templateId }) =>
            publish.mutate(
              { project, id, templateId },
              {
                onSuccess: (r) => {
                  setDialog(null);
                  displaySuccessToast(
                    t("wfPublished", { id: r.templateId, v: r.version }),
                  );
                },
                onError: reportFactoryError,
              },
            )
          }
        />
      )}
      {modal}
    </div>
  );
}
