/* eslint-disable i18next/no-literal-string -- factory UI is French-only */
import React from "react";
import { cn } from "#/utils/utils";
import { useSendMessage } from "#/hooks/use-send-message";
import { createChatMessage } from "#/services/chat-service";
import { openWorkspaceFile } from "#/services/canvas-ui";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useOptimisticUserMessageStore } from "#/stores/optimistic-user-message-store";
import {
  DEFAULT_OUTCOMES,
  type FactoryOutcome,
  type FactoryStepStatus,
  type FactoryTicket,
  useFactoryTicket,
} from "./ticket";

const STEP_ICON: Record<FactoryStepStatus, string> = {
  done: "✅",
  current: "⏳",
  review: "👀",
  todo: "○",
};

/** Sends a decision as a normal chat message; the orchestrator reads it. */
function useSendDecision() {
  const { send } = useSendMessage();
  const { conversationId } = useOptionalConversationId();
  const enqueue = useOptimisticUserMessageStore((s) => s.enqueuePendingMessage);
  const markError = useOptimisticUserMessageStore(
    (s) => s.markPendingMessageError,
  );
  return React.useCallback(
    (text: string) => {
      const timestamp = new Date().toISOString();
      const pendingId = conversationId
        ? enqueue({ conversationId, text, timestamp })
        : null;
      send(createChatMessage(text, [], [], timestamp)).catch((error) => {
        if (pendingId)
          markError(
            pendingId,
            error instanceof Error ? error.message : "Échec de l’envoi",
          );
      });
    },
    [send, conversationId, enqueue, markError],
  );
}

function Stepper({ steps }: { steps: FactoryTicket["steps"] }) {
  return (
    <ol className="flex flex-col gap-1" data-testid="factory-steps">
      {steps.map((s) => (
        <li
          key={s.key}
          className={cn(
            "flex items-center gap-2 text-sm",
            s.status === "todo" ? "text-muted" : "text-foreground",
            (s.status === "current" || s.status === "review") &&
              "font-semibold",
          )}
        >
          <span aria-hidden className="w-5 text-center">
            {STEP_ICON[s.status]}
          </span>
          <span>{s.label}</span>
          {s.status === "review" && (
            <span className="text-xs text-feedback-warning">à valider</span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** The text the orchestrator reads: "/decide <outcome> [remarks]". */
export function decisionCommand(outcomeId: string, remarks: string): string {
  const r = remarks.trim();
  return r ? `/decide ${outcomeId} ${r}` : `/decide ${outcomeId}`;
}

const OUTCOME_STYLE: Record<FactoryOutcome["kind"], string> = {
  approve: "bg-contrast text-contrast-foreground hover:opacity-90",
  changes: "border border-border text-foreground hover:bg-interactive-hover",
  reject:
    "border border-feedback-warning text-feedback-warning hover:opacity-90",
  other: "border border-border text-foreground hover:bg-interactive-hover",
};

function Decision({ ticket }: { ticket: FactoryTicket }) {
  const sendDecision = useSendDecision();
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [remarks, setRemarks] = React.useState("");
  const [sent, setSent] = React.useState<string | null>(null);
  const review = ticket.review!;
  const outcomes = review.outcomes?.length ? review.outcomes : DEFAULT_OUTCOMES;

  // A new review (state change) resets the local form.
  React.useEffect(() => {
    setConfirming(null);
    setRemarks("");
    setSent(null);
  }, [ticket.state, ticket.node, ticket.updatedAt]);

  if (sent) {
    return (
      <p className="text-sm text-muted" data-testid="factory-decision-sent">
        Décision envoyée ({sent}). L’orchestrateur la prend en compte sous une
        minute.
      </p>
    );
  }

  const choose = (o: FactoryOutcome) => {
    // Approvals and rejections are confirmed by a second click.
    if ((o.kind === "approve" || o.kind === "reject") && confirming !== o.id) {
      setConfirming(o.id);
      return;
    }
    sendDecision(decisionCommand(o.id, remarks));
    setSent(o.label);
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3"
      data-testid="factory-decision"
    >
      <p className="text-sm text-foreground">
        <strong>Ta décision</strong> sur {review.what}
      </p>
      {review.instructions && (
        <p className="whitespace-pre-wrap text-xs text-muted">
          {review.instructions}
        </p>
      )}
      {review.files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {review.files.map((f) => (
            <li key={f}>
              <button
                type="button"
                className="cursor-pointer font-mono text-xs text-foreground underline underline-offset-2 hover:opacity-80"
                onClick={() => openWorkspaceFile(f)}
              >
                {f}
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        data-testid="factory-remarks"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        rows={3}
        placeholder="Remarques (obligatoires pour certains choix)…"
        className="w-full resize-y rounded border border-border bg-transparent p-2 text-sm text-foreground"
      />
      <div className="flex flex-wrap items-center gap-2">
        {outcomes.map((o) => {
          const disabled = o.requireComment && !remarks.trim();
          return (
            <button
              key={o.id}
              type="button"
              data-testid={`factory-outcome-${o.id}`}
              disabled={disabled}
              title={disabled ? "Écris d’abord une remarque" : undefined}
              className={cn(
                "rounded px-3 py-1 text-sm",
                OUTCOME_STYLE[o.kind],
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              )}
              onClick={() => choose(o)}
            >
              {confirming === o.id ? `Confirmer : ${o.label}` : o.label}
            </button>
          );
        })}
        {confirming && (
          <button
            type="button"
            className="cursor-pointer text-xs text-muted hover:underline"
            onClick={() => setConfirming(null)}
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}

export function FactoryTicketView({ ticket }: { ticket: FactoryTicket }) {
  return (
    <div className="flex flex-col gap-4 text-foreground">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">
          🏭{" "}
          {ticket.url ? (
            <a
              href={ticket.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              #{ticket.issue}
            </a>
          ) : (
            `#${ticket.issue}`
          )}{" "}
          {ticket.title}
        </h2>
        <p className="text-xs text-muted">
          {[
            ticket.repo,
            ticket.branch,
            ticket.workflow &&
              `workflow ${ticket.workflow.name} (v${ticket.workflow.version})`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      <p className="text-sm" data-testid="factory-state">
        État : <strong>{ticket.stateLabel}</strong>
      </p>
      {ticket.note && (
        <p className="whitespace-pre-wrap rounded bg-surface p-2 text-xs">
          {ticket.note}
        </p>
      )}
      <Stepper steps={ticket.steps} />
      {ticket.pr && (
        <p className="text-sm">
          PR :{" "}
          <a
            href={ticket.pr.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            #{ticket.pr.number}
          </a>
          {ticket.pr.draft ? " (brouillon)" : ""}
        </p>
      )}
      {ticket.review && <Decision ticket={ticket} />}
      <p className="text-xs text-muted">
        Mis à jour {new Date(ticket.updatedAt).toLocaleString("fr-FR")}
      </p>
    </div>
  );
}

export default function FactoryTicketTab() {
  const { data: ticket, isLoading } = useFactoryTicket();
  if (isLoading)
    return <div className="p-4 text-sm text-muted">Chargement…</div>;
  if (!ticket) {
    return (
      <div className="p-4 text-sm text-muted">
        Cette conversation n’est pas un ticket de la factory.
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto p-4">
      <FactoryTicketView ticket={ticket} />
    </div>
  );
}
