/**
 * The factory's pending human decision as a form in the chat flow, above the
 * composer (like Claude Code's questions and Canvas' ask_user card): one button
 * per choice, an optional comment, sent to the orchestrator (POST /runs/:id/decide).
 * The Ticket tab keeps the full review (files, diff).
 */
import React from "react";
import { Check, FileText, Globe } from "lucide-react";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useSelectConversationTab } from "#/hooks/use-select-conversation-tab";
import { MarkdownRenderer } from "#/components/features/markdown/markdown-renderer";
import { formControlMultilineFieldClassName } from "#/utils/form-control-classes";
import { cn } from "#/utils/utils";
import { reportFactoryError, useDecide } from "./api";
import { needsConfirmation } from "./decision-panel";
import { useFactoryT } from "./i18n";
import { useConversationRun } from "./run-status";
import { useFactoryPreview } from "./preview-panel";
import {
  useFactoryTicket,
  type FactoryOutcome,
  type FactoryTicket,
} from "./ticket";
import { useConfirm } from "./ui";

const HINT: Record<
  FactoryOutcome["kind"],
  "outcomeHintApprove" | "outcomeHintChanges" | "outcomeHintReject" | null
> = {
  approve: "outcomeHintApprove",
  changes: "outcomeHintChanges",
  reject: "outcomeHintReject",
  other: null,
};

export function FactoryDecisionFormView({
  review,
  sending,
  sent,
  onSend,
  onOpenReview,
  onOpenPreview,
}: {
  review: NonNullable<FactoryTicket["review"]>;
  sending: boolean;
  sent: string | null;
  onSend: (o: FactoryOutcome, comment: string) => void;
  onOpenReview?: () => void;
  /** The project has a stack preview: open it in the browser panel. */
  onOpenPreview?: () => void;
}) {
  const t = useFactoryT();
  const [comment, setComment] = React.useState("");
  const [missing, setMissing] = React.useState<string | null>(null);
  const [showMore, setShowMore] = React.useState(false);
  const commentRef = React.useRef<HTMLTextAreaElement>(null);
  const titleId = React.useId();
  const outcomes = review.outcomes ?? [];
  const long = (review.instructions ?? "").length > 600;

  if (sent) {
    return (
      <section
        className="mx-auto my-3 flex w-full max-w-3xl items-center gap-2 rounded-xl border border-border bg-surface p-3 text-sm text-muted"
        data-testid="factory-decision-form-sent"
      >
        <Check className="size-4 text-success" aria-hidden />
        {t("decisionSentInline", { label: sent })}
      </section>
    );
  }

  const pick = (o: FactoryOutcome) => {
    if (o.requireComment && !comment.trim()) {
      setMissing(o.label);
      commentRef.current?.focus();
      return;
    }
    setMissing(null);
    onSend(o, comment.trim());
  };

  return (
    <section
      aria-labelledby={titleId}
      className="mx-auto my-3 flex w-full max-w-3xl min-w-0 flex-col gap-3 rounded-xl border border-warning bg-surface p-4 text-sm text-contrast"
      data-testid="factory-decision-form"
    >
      <div className="flex items-start gap-2">
        <h3 id={titleId} className="min-w-0 flex-1 font-medium wrap-anywhere">
          {t("decisionWaiting", { what: review.what })}
        </h3>
        {onOpenPreview && (
          <button
            type="button"
            onClick={onOpenPreview}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted underline underline-offset-2 hover:text-content"
            data-testid="factory-decision-form-preview"
          >
            <Globe className="size-3.5" aria-hidden />
            {t("decisionPreview")}
          </button>
        )}
        {onOpenReview && review.files.length > 0 && (
          <button
            type="button"
            onClick={onOpenReview}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted underline underline-offset-2 hover:text-content"
            data-testid="factory-decision-form-files"
          >
            <FileText className="size-3.5" aria-hidden />
            {review.files.some((f) => f.startsWith("specs/demo/"))
              ? t("decisionDemo")
              : t("decisionFiles", { n: review.files.length })}
          </button>
        )}
      </div>
      {review.instructions && (
        <div
          className={cn(
            "min-w-0 text-muted",
            long && !showMore && "max-h-40 overflow-hidden",
          )}
        >
          <MarkdownRenderer includeStandard>
            {review.instructions}
          </MarkdownRenderer>
        </div>
      )}
      {long && (
        <button
          type="button"
          className="self-start text-xs text-muted underline underline-offset-2"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? t("showLess") : t("decisionMore")}
        </button>
      )}
      <fieldset
        disabled={sending}
        aria-labelledby={titleId}
        className="flex min-w-0 flex-col gap-2"
      >
        {outcomes.map((o) => {
          const hint = HINT[o.kind];
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => pick(o)}
              className={cn(
                "min-w-0 cursor-pointer rounded-lg border p-3 text-start hover:bg-interactive-hover disabled:cursor-wait disabled:opacity-60",
                missing === o.label ? "border-warning" : "border-control",
              )}
              data-testid={`factory-decision-option-${o.id}`}
            >
              <span className="font-medium">{o.label}</span>
              {o.requireComment && (
                <span className="ml-2 text-xs text-muted">
                  {t("decisionNeedsComment")}
                </span>
              )}
              {hint && <span className="mt-1 block text-muted">{t(hint)}</span>}
            </button>
          );
        })}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${titleId}-c`} className="text-muted">
          {missing
            ? t("commentRequired", { label: missing })
            : t("decisionComment")}
        </label>
        <textarea
          id={`${titleId}-c`}
          ref={commentRef}
          rows={2}
          value={comment}
          disabled={sending}
          onChange={(e) => setComment(e.target.value)}
          className={formControlMultilineFieldClassName}
          data-testid="factory-decision-comment"
        />
      </div>
    </section>
  );
}

export function FactoryDecisionForm() {
  const t = useFactoryT();
  const { data: ticket } = useFactoryTicket();
  const { conversationId } = useOptionalConversationId();
  const run = useConversationRun(conversationId ?? undefined);
  const decide = useDecide();
  const { ask, modal } = useConfirm();
  const { selectTab } = useSelectConversationTab();
  const preview = useFactoryPreview();
  const [sent, setSent] = React.useState<{
    node: string;
    label: string;
  } | null>(null);
  const review = ticket?.state === "HUMAN" ? ticket.review : null;
  if (!review?.outcomes?.length || !run) return null;
  const node = ticket?.node ?? "";

  const send = (o: FactoryOutcome, comment: string) => {
    const go = () =>
      decide.mutate(
        { runId: run.id, outcome: o.id, comment },
        {
          onSuccess: () => setSent({ node, label: o.label }),
          onError: reportFactoryError,
        },
      );
    if (needsConfirmation(o))
      ask(t("decideConfirm", { label: o.label, what: review.what }), go, {
        confirmText: o.label,
      });
    else go();
  };

  return (
    <>
      <FactoryDecisionFormView
        // A new human step (or the same node visited again) resets the form.
        key={`${run.id}:${node}:${ticket?.updatedAt}`}
        review={review}
        sending={decide.isPending}
        sent={sent?.node === node ? sent.label : null}
        onSend={send}
        onOpenReview={() => selectTab("ticket")}
        onOpenPreview={
          preview
            ? () => window.open(preview.url, "_blank", "noopener,noreferrer")
            : undefined
        }
      />
      {modal}
    </>
  );
}
