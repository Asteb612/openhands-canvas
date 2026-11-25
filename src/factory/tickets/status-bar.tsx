/** Factory health for the owner: global pause, Claude subscriptions and their quota, push. */
import { Hourglass, PauseCircle, PlayCircle } from "lucide-react";
import { cn } from "#/utils/utils";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import { reportFactoryError, useFactoryStatus, useSetControl } from "../api";
import { useFactoryLocale, useFactoryT } from "../i18n";
import { Button, Pill, useConfirm } from "../ui";

export function FactoryStatusBar() {
  const t = useFactoryT();
  const locale = useFactoryLocale();
  const { data: status } = useFactoryStatus();
  const control = useSetControl();
  const { ask, modal } = useConfirm();
  if (!status) return null;
  const paused = status.control.paused;
  const hhmm = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  const set = (next: boolean) =>
    control.mutate(
      { paused: next, reason: next ? "dashboard" : "" },
      {
        onSuccess: () =>
          displaySuccessToast(next ? t("pausedToast") : t("resumedToast")),
        onError: reportFactoryError,
      },
    );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-base-secondary px-3 py-2 text-sm",
        paused || status.subscriptions.some((s) => s.suspendedUntil)
          ? "border-warning"
          : "border-border",
      )}
      data-testid="factory-status-bar"
    >
      {paused ? (
        <Pill
          tone="warning"
          icon={<PauseCircle className="size-3" aria-hidden />}
          testId="factory-paused"
        >
          {t("factoryPaused", { by: status.control.by ?? "?" })}
        </Pill>
      ) : (
        <span className="text-content">
          {t("factoryActive", { n: status.capacity.active })}
        </span>
      )}
      {status.subscriptions.map((s) =>
        s.suspendedUntil ? (
          <Pill
            key={s.id}
            tone="warning"
            icon={<Hourglass className="size-3" aria-hidden />}
            testId={`factory-quota-${s.id}`}
          >
            {t("quotaHit", {
              label: s.label,
              time: hhmm(s.suspendedUntil),
              projects: s.projects.join(", "),
            })}
          </Pill>
        ) : (
          <span
            key={s.id}
            className="text-muted"
            data-testid={`factory-quota-${s.id}`}
            title={s.last?.message}
          >
            {t("quotaOk", { label: s.label })}
          </span>
        ),
      )}
      <span className="flex w-full items-center justify-between gap-3 sm:ml-auto sm:w-auto sm:justify-start">
        <span className="text-muted">
          {status.push ? t("pushOn") : t("pushOff")}
        </span>
        {paused ? (
          <Button
            type="button"
            variant="primary"
            isDisabled={control.isPending}
            onClick={() => set(false)}
            testId="factory-pause-toggle"
            startContent={<PlayCircle className="size-4" aria-hidden />}
          >
            {t("resume")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            isDisabled={control.isPending}
            onClick={() =>
              ask(t("pauseAllConfirm"), () => set(true), {
                confirmText: t("pauseAll"),
              })
            }
            testId="factory-pause-toggle"
            startContent={<PauseCircle className="size-4" aria-hidden />}
          >
            {t("pauseAll")}
          </Button>
        )}
      </span>
      {modal}
    </div>
  );
}
