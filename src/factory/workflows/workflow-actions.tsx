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
import { Button, useConfirm, type KebabMenuItem } from "../ui";
import { IdDialog } from "./id-dialog";

export interface WorkflowActionsArgs {
  scope: WorkflowScope;
  summary: WorkflowSummary;
  dirty: boolean;
  /** Opens another workflow of the same scope (the new copy). */
  onOpen: (id: string) => void;
}

/**
 * The actions on a workflow (duplicate, publish as template, reset, archive) as menu
 * items, plus their dialogs: the detail page shows them in its kebab menu, the
 * editor's side panel as buttons.
 */
export function useWorkflowActions({
  scope,
  summary,
  dirty,
  onOpen,
}: WorkflowActionsArgs): {
  items: (KebabMenuItem & { testId: string })[];
  dialogs: React.ReactNode;
} {
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
  const { data: scopeIds } = useWorkflows(dialog ? scope : null, true);
  const { data: templates } = useWorkflows(
    dialog === "publish" ? TEMPLATE_SCOPE : null,
    true,
  );
  const project = scope.kind === "project" ? scope.project : null;
  const id = summary.id;

  const items: (KebabMenuItem & { testId: string })[] = [
    {
      testId: "wf-duplicate",
      label: t("wfDuplicate"),
      icon: <Copy className="size-4" aria-hidden />,
      onClick: () => setDialog("duplicate"),
    },
    ...(project
      ? [
          {
            testId: "wf-publish",
            label: t("publishAsTemplate"),
            icon: <Upload className="size-4" aria-hidden />,
            disabled: dirty,
            onClick: () => setDialog("publish"),
          },
        ]
      : []),
    ...(scope.kind === "template" && summary.builtin && summary.customised
      ? [
          {
            testId: "wf-reset",
            label: t("resetTemplate"),
            icon: <RotateCcw className="size-4" aria-hidden />,
            disabled: reset.isPending || dirty,
            onClick: () =>
              ask(t("wfResetConfirm", { name: summary.name }), () =>
                reset.mutate(
                  { scope, id },
                  {
                    onSuccess: (r) =>
                      displaySuccessToast(t("wfResetDone", { v: r.version })),
                    onError: reportFactoryError,
                  },
                ),
              ),
          },
        ]
      : []),
    {
      testId: "wf-archive",
      label: summary.archived ? t("wfUnarchive") : t("wfArchive"),
      icon: summary.archived ? (
        <ArchiveRestore className="size-4" aria-hidden />
      ) : (
        <Archive className="size-4" aria-hidden />
      ),
      disabled: archive.isPending,
      onClick: () =>
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
        ),
    },
  ];

  const dialogs = (
    <>
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
    </>
  );
  return { items, dialogs };
}

/** The actions as buttons (editor side panel, nothing selected). */
export function WorkflowActions(props: WorkflowActionsArgs) {
  const t = useFactoryT();
  const { items, dialogs } = useWorkflowActions(props);
  return (
    <div
      className="flex flex-col gap-2 border-t border-border pt-4"
      data-testid="wf-actions"
    >
      <h3 className="mb-1 text-sm font-medium text-content">
        {t("wfActions")}
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <Button
            key={it.testId}
            type="button"
            variant="secondary"
            testId={it.testId}
            isDisabled={it.disabled}
            startContent={it.icon}
            onClick={it.onClick}
          >
            {it.label}
          </Button>
        ))}
      </div>
      {props.dirty && <p className="text-xs text-muted">{t("wfSaveFirst")}</p>}
      {dialogs}
    </div>
  );
}
