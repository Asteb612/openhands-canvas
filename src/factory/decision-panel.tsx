/**
 * The one decision UI (Ticket tab and dashboard): files of the human node, comment,
 * one button per outcome, through the orchestrator API (it posts "/decide" where the
 * engine reads decisions). Approvals and rejections are confirmed in the Canvas modal.
 */
import React from "react";
import { FileText } from "lucide-react";
import { MarkdownRenderer } from "#/components/features/markdown/markdown-renderer";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import { cn } from "#/utils/utils";
import {
  reportFactoryError,
  useDecide,
  useReview,
  type ReviewData,
} from "./api";
import { useFactoryT } from "./i18n";
import { Button, StateMessage, textareaClassName, useConfirm } from "./ui";

type Outcome = ReviewData["node"]["outcomes"][number];

const VARIANT: Record<string, "primary" | "secondary" | "danger"> = {
  approve: "primary",
  changes: "secondary",
  reject: "danger",
  other: "secondary",
};

export function needsConfirmation(o: Pick<Outcome, "kind">): boolean {
  return o.kind === "approve" || o.kind === "reject";
}

export function DecisionPanel({
  runId,
  onDecided,
  onOpenFile,
}: {
  runId: number;
  onDecided?: () => void;
  /** Inside a conversation: open a review file in Canvas' file viewer instead. */
  onOpenFile?: (path: string) => void;
}) {
  const t = useFactoryT();
  const { data, error, isLoading } = useReview(runId);
  const decide = useDecide();
  const { ask, modal } = useConfirm();
  const [fileIdx, setFileIdx] = React.useState(0);
  const [comment, setComment] = React.useState("");

  if (isLoading) return <StateMessage kind="loading" />;
  if (error || !data)
    return (
      <StateMessage kind="error">
        {(error as Error | null)?.message}
      </StateMessage>
    );

  const send = (o: Outcome) => {
    if (o.requireComment && !comment.trim()) {
      reportFactoryError(t("commentRequired", { label: o.label }));
      return;
    }
    const go = () =>
      decide.mutate(
        { runId, outcome: o.id, comment: comment.trim() },
        {
          onSuccess: () => {
            displaySuccessToast(t("decisionSent", { label: o.label }));
            setComment("");
            onDecided?.();
          },
          onError: reportFactoryError,
        },
      );
    if (needsConfirmation(o))
      ask(t("decideConfirm", { label: o.label, what: data.node.what }), go, {
        confirmText: o.label,
      });
    else go();
  };

  const file = data.files[fileIdx];
  return (
    <div className="flex min-h-0 flex-col gap-3" data-testid="factory-decision">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-medium text-content">
          {data.node.title}
        </h3>
        <p className="text-sm text-muted">
          {t("decisionWaiting", { what: data.node.what })}
        </p>
        {data.node.instructions && (
          <p className="whitespace-pre-wrap text-sm text-muted">
            {data.node.instructions}
          </p>
        )}
      </div>
      {data.files.length > 0 ? (
        <>
          <div
            className="flex flex-wrap gap-1"
            role="tablist"
            aria-label={t("approvedFiles")}
          >
            {data.files.map((f, i) => (
              <button
                key={f.path}
                type="button"
                role="tab"
                aria-selected={i === fileIdx}
                onClick={() =>
                  onOpenFile ? onOpenFile(f.path) : setFileIdx(i)
                }
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 font-mono text-xs",
                  i === fileIdx && !onOpenFile
                    ? "bg-surface-raised text-content"
                    : "text-muted hover:text-content",
                )}
              >
                <FileText className="size-3" aria-hidden />
                {f.path}
              </button>
            ))}
          </div>
          {!onOpenFile && (
            <div
              className="min-h-40 overflow-y-auto rounded-lg border border-border bg-canvas-base p-3 text-sm"
              data-testid="review-file"
            >
              {file?.content == null ? (
                <p className="text-muted">{t("fileMissing")}</p>
              ) : file.path.endsWith(".md") ? (
                <MarkdownRenderer content={file.content} includeStandard />
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {file.content}
                </pre>
              )}
              {file?.truncated && (
                <p className="mt-2 text-xs text-muted">{t("truncated")}</p>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">{t("noReviewFiles")}</p>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-content">{t("comment")}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className={textareaClassName}
          data-testid="review-comment"
        />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        {data.node.outcomes.map((o) => (
          <Button
            key={o.id}
            type="button"
            variant={VARIANT[o.kind] ?? "secondary"}
            isDisabled={
              decide.isPending || (o.requireComment && !comment.trim())
            }
            onClick={() => send(o)}
            testId={`review-outcome-${o.id}`}
          >
            {o.label}
          </Button>
        ))}
      </div>
      {modal}
    </div>
  );
}
