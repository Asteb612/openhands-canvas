/* eslint-disable i18next/no-literal-string -- factory UI is French-only */
import React from "react";
import toast from "react-hot-toast";
import { cn } from "#/utils/utils";
import { useFactoryStatus, useSetControl } from "../workflows/api";
import {
  enableBrowserNotifications,
  notificationsSupported,
  useNotifyPref,
} from "../notifier";

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

/** Factory health for the owner: global pause, subscription quota, notifications. */
export function FactoryStatusBar() {
  const { data: status, error } = useFactoryStatus();
  const control = useSetControl();
  const [armed, setArmed] = React.useState(false);
  const notifyOn = useNotifyPref((s) => s.enabled);
  const setNotify = useNotifyPref((s) => s.setEnabled);
  if (error || !status) return null;

  const paused = status.control.paused;
  const { suspended, last } = status.quota;
  const nextReset = suspended[0]?.until;
  const toggle = () => {
    if (!paused && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    control.mutate(
      { paused: !paused, reason: paused ? "" : "pause depuis le dashboard" },
      {
        onSuccess: () =>
          toast.success(
            paused
              ? "Factory relancée"
              : "Factory en pause : aucune nouvelle étape ne sera envoyée",
          ),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border px-3 py-1.5 text-xs",
        paused || suspended.length
          ? "border-feedback-warning"
          : "border-border",
      )}
      data-testid="factory-status-bar"
    >
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "inline-block size-2 rounded-full",
            paused
              ? "bg-feedback-warning"
              : suspended.length
                ? "bg-feedback-warning"
                : "bg-status-success",
          )}
        />
        {paused ? (
          <span className="text-feedback-warning" data-testid="factory-paused">
            En pause
            {status.control.by ? ` (par ${status.control.by}` : ""}
            {status.control.at
              ? `, ${hhmm(status.control.at)})`
              : status.control.by
                ? ")"
                : ""}
          </span>
        ) : (
          <span>
            Factory active · {status.capacity.active}
            {status.capacity.global ? `/${status.capacity.global}` : ""}{" "}
            agent(s) en cours
          </span>
        )}
      </span>
      <span data-testid="factory-quota">
        {suspended.length ? (
          <span className="text-feedback-warning">
            ⌛ Quota de l’abonnement atteint : {suspended.length} run(s)
            suspendu(s), reprise vers {hhmm(nextReset!)}
          </span>
        ) : last ? (
          <span className="text-muted" title={last.message}>
            Quota OK (dernier dépassement{" "}
            {new Date(last.at).toLocaleString("fr-FR")})
          </span>
        ) : (
          <span className="text-muted">Quota OK</span>
        )}
      </span>
      <span className="ml-auto flex items-center gap-3">
        <span className="text-muted">
          Push {status.push ? "ntfy actif" : "non configuré"}
        </span>
        {notificationsSupported() && (
          <button
            type="button"
            className="cursor-pointer text-muted hover:text-foreground"
            onClick={async () => {
              if (notifyOn) {
                setNotify(false);
                return;
              }
              const ok = await enableBrowserNotifications();
              if (!ok)
                toast.error(
                  "Notifications refusées par le navigateur (réglage du site).",
                );
            }}
            data-testid="factory-browser-notify"
          >
            {notifyOn
              ? "🔔 Notifications du navigateur : oui"
              : "🔕 Activer les notifications"}
          </button>
        )}
        <button
          type="button"
          onClick={toggle}
          onBlur={() => setArmed(false)}
          disabled={control.isPending}
          className={cn(
            "cursor-pointer rounded px-2 py-0.5 font-semibold disabled:opacity-50",
            paused
              ? "bg-contrast text-contrast-foreground hover:opacity-90"
              : "border border-border hover:bg-tertiary",
          )}
          data-testid="factory-pause-toggle"
        >
          {paused
            ? "Reprendre"
            : armed
              ? "Confirmer la pause"
              : "Tout mettre en pause"}
        </button>
      </span>
    </div>
  );
}
