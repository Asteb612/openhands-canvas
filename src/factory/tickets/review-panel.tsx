/* eslint-disable i18next/no-literal-string -- factory UI is French-only */
import React from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { MarkdownRenderer } from "#/components/features/markdown/markdown-renderer";
import { cn } from "#/utils/utils";
import { useDecide, useReview, type ReviewData } from "../workflows/api";

type Outcome = ReviewData["node"]["outcomes"][number];

const OUTCOME_STYLE: Record<string, string> = {
  approve: "bg-contrast text-contrast-foreground hover:opacity-90",
  changes: "border border-border text-foreground hover:bg-tertiary",
  reject: "border border-status-error text-status-error hover:bg-tertiary",
  other: "border border-border text-foreground hover:bg-tertiary",
};

/** Approvals and rejections are asked twice; a "changes" request needs its comment anyway. */
export function needsConfirmation(o: Outcome): boolean {
  return o.kind === "approve" || o.kind === "reject";
}

/** Review a run waiting on a human node, then decide, without leaving the dashboard. */
export function ReviewPanel({
  runId,
  onClose,
}: {
  runId: number;
  onClose: () => void;
}) {
  const { data, error, isLoading } = useReview(runId);
  const decide = useDecide();
  const [fileIdx, setFileIdx] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [armed, setArmed] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = (o: Outcome) => {
    if (o.requireComment && !comment.trim()) {
      toast.error(`« ${o.label} » demande un commentaire.`);
      return;
    }
    if (needsConfirmation(o) && armed !== o.id) {
      setArmed(o.id);
      return;
    }
    setArmed(null);
    decide.mutate(
      { runId, outcome: o.id, comment: comment.trim() },
      {
        onSuccess: (r) => {
          toast.success(
            `${o.label} envoyé (${r.via === "canvas" ? "conversation" : "issue GitHub"}). La factory l'applique au prochain passage.`,
          );
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const file = data?.files[fileIdx];
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      data-testid="review-panel"
    >
      <div className="flex h-full w-full max-w-3xl flex-col gap-3 overflow-hidden border-l border-border bg-base-secondary p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">
              {data
                ? `#${data.run.issue} · ${data.run.workflow} · ${data.node.label}`
                : `run ${runId}`}
            </div>
            <h2 className="text-base font-semibold">
              {data ? data.node.title : "Décision"}
            </h2>
            {data && (
              <div className="text-sm text-foreground">{data.run.title}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="cursor-pointer text-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {isLoading && <p className="text-sm text-muted">Chargement…</p>}
        {error && (
          <p className="text-sm text-status-error">
            {(error as Error).message}
          </p>
        )}
        {data && (
          <>
            {data.node.instructions && (
              <p className="whitespace-pre-wrap text-xs text-muted">
                {data.node.instructions}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {data.files.map((f, i) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setFileIdx(i)}
                  className={cn(
                    "cursor-pointer rounded border px-2 py-0.5 font-mono text-2xs",
                    i === fileIdx
                      ? "border-contrast text-foreground"
                      : "border-border text-muted",
                  )}
                >
                  {f.path}
                  {f.content === null ? " (absent)" : ""}
                </button>
              ))}
              {data.run.conversationId && (
                <Link
                  to={`/conversations/${data.run.conversationId}`}
                  className="ml-auto text-xs text-muted underline underline-offset-2"
                >
                  Ouvrir la conversation
                </Link>
              )}
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto rounded border border-border bg-surface p-3 text-sm"
              data-testid="review-file"
            >
              {!file && (
                <p className="text-muted">
                  Cette étape ne liste aucun fichier : voir la conversation
                  {data.run.prNumber ? ` ou la PR #${data.run.prNumber}` : ""}.
                </p>
              )}
              {file?.content === null && (
                <p className="text-muted">
                  Fichier absent du workspace du ticket.
                </p>
              )}
              {file?.content != null &&
                (file.path.endsWith(".md") ? (
                  <MarkdownRenderer content={file.content} includeStandard />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-xs">
                    {file.content}
                  </pre>
                ))}
              {file?.truncated && (
                <p className="mt-2 text-xs text-muted">
                  (tronqué : la suite est dans la conversation)
                </p>
              )}
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Commentaire (transmis à l’agent avec la décision)
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="rounded border border-border bg-base-secondary px-2 py-1 text-sm text-foreground"
                data-testid="review-comment"
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              {data.node.outcomes.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => send(o)}
                  onBlur={() => armed === o.id && setArmed(null)}
                  className={cn(
                    "cursor-pointer rounded px-3 py-1 text-xs font-semibold disabled:opacity-50",
                    OUTCOME_STYLE[o.kind] ?? OUTCOME_STYLE.other,
                  )}
                  data-testid={`review-outcome-${o.id}`}
                >
                  {armed === o.id ? `Confirmer : ${o.label}` : o.label}
                  {o.requireComment ? " ✎" : ""}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
