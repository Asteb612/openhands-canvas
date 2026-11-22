import type { FactoryKey } from "./i18n";

type T = (key: FactoryKey, vars?: Record<string, string | number>) => string;

/** Compact duration: "45 s", "12 min", "3 h 20", "2 j 4 h". */
export function formatDuration(
  t: T,
  seconds: number | null | undefined,
): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds))
    return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return t("seconds", { n: s });
  const m = Math.round(s / 60);
  if (m < 60) return t("minutes", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24)
    return m % 60
      ? t("hoursMinutes", { h, m: String(m % 60).padStart(2, "0") })
      : t("hours", { n: h });
  const d = Math.floor(h / 24);
  return h % 24 ? t("daysHours", { d, h: h % 24 }) : t("days", { n: d });
}

/** Time since an instant, compact ("à l'instant", "15 min", "3 h", "4 j"). */
export function since(
  t: T,
  iso: string | null | undefined,
  now = Date.now(),
): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return t("justNow");
  const m = Math.round(s / 60);
  if (m < 60) return t("minutes", { n: m });
  const h = Math.round(m / 60);
  if (h < 48) return t("hours", { n: h });
  return t("days", { n: Math.round(h / 24) });
}

/** "3 runs in 30 d · 50% succeeded · avg 12 min" (success over finished runs only). */
export function activityLine(
  t: T,
  a: {
    runs: number;
    completed: number;
    failed: number;
    avgSeconds: number | null;
  },
): string {
  const runs = t(a.runs === 1 ? "activityRuns1" : "activityRuns", {
    n: a.runs,
  });
  const finished = a.completed + a.failed;
  if (!finished) return runs;
  return t("activityLine", {
    runs,
    ok: Math.round((a.completed / finished) * 100),
    avg: formatDuration(t, a.avgSeconds),
  });
}
