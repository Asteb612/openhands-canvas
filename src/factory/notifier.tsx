import React from "react";
import { create } from "zustand";
import { useNavigation } from "#/context/navigation-context";
import { useFactoryStatus, useRuns, type FactoryRun } from "./workflows/api";

const PREF_KEY = "factory.browserNotifications";

function readPref(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

interface NotifyPrefState {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

/** Per-browser switch (the permission itself belongs to the browser). */
export const useNotifyPref = create<NotifyPrefState>((set) => ({
  enabled: typeof window === "undefined" ? false : readPref(),
  setEnabled: (enabled) => {
    try {
      window.localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
    } catch {
      // ignored: the switch lasts for this tab only
    }
    set({ enabled });
  },
}));

/** Asks the browser (needs a click), then turns the switch on if granted. */
export async function enableBrowserNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const perm =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  useNotifyPref.getState().setEnabled(perm === "granted");
  return perm === "granted";
}

export interface RunAlert {
  key: string;
  title: string;
  body: string;
  conversationId: string | null;
}

/**
 * New alerts between two run lists: a run that entered HUMAN or FAILED. The first
 * list seen only primes the memory (no burst of old alerts on page load).
 */
export function diffAlerts(
  previous: Map<number, string> | null,
  runs: FactoryRun[],
): RunAlert[] {
  if (!previous) return [];
  const out: RunAlert[] = [];
  for (const r of runs) {
    const before = previous.get(r.id);
    if (before === r.state) continue;
    if (r.state === "HUMAN")
      out.push({
        key: `run-${r.id}-human-${r.node ?? ""}`,
        title: `🏭 #${r.issue} à valider`,
        body: `${r.title}${r.nodeLabel ? ` · ${r.nodeLabel}` : ""}`,
        conversationId: r.conversationId,
      });
    if (r.state === "FAILED")
      out.push({
        key: `run-${r.id}-failed`,
        title: `🏭 #${r.issue} en échec`,
        body: `${r.title}${r.failureMessage ? ` · ${r.failureMessage.slice(0, 140)}` : ""}`,
        conversationId: r.conversationId,
      });
  }
  return out;
}

/**
 * Mounted once (sidebar): watches the runs and the quota while Canvas is open in a
 * tab, and raises a browser notification when a ticket needs the owner. The
 * orchestrator's ntfy push covers the closed-tab case.
 */
export function FactoryNotifier() {
  const enabled = useNotifyPref((s) => s.enabled);
  const { data: runs } = useRuns();
  const { data: status } = useFactoryStatus();
  const { navigate } = useNavigation();
  const seen = React.useRef<Map<number, string> | null>(null);
  const lastQuota = React.useRef<string | null | undefined>(undefined);

  const show = React.useCallback(
    (title: string, body: string, tag: string, to: string) => {
      if (!enabled || !notificationsSupported()) return;
      if (Notification.permission !== "granted") return;
      try {
        const n = new Notification(title, { body, tag });
        n.onclick = () => {
          window.focus();
          navigate(to);
          n.close();
        };
      } catch {
        // some browsers only allow notifications from a service worker
      }
    },
    [enabled, navigate],
  );

  React.useEffect(() => {
    if (!runs) return;
    for (const a of diffAlerts(seen.current, runs))
      show(
        a.title,
        a.body,
        a.key,
        a.conversationId ? `/conversations/${a.conversationId}` : "/tickets",
      );
    seen.current = new Map(runs.map((r) => [r.id, r.state]));
  }, [runs, show]);

  React.useEffect(() => {
    if (!status) return;
    const at = status.quota.last?.at ?? null;
    if (lastQuota.current !== undefined && at && at !== lastQuota.current) {
      const until = status.quota.last?.until;
      show(
        "🏭 Quota de l'abonnement atteint",
        until
          ? `Reprise vers ${new Date(until).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
          : "Les runs reprendront après le reset.",
        "factory-quota",
        "/tickets",
      );
    }
    lastQuota.current = at;
  }, [status, show]);

  return null;
}
