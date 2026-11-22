/**
 * Factory dashboard (/factory), like the automations dashboard: health tiles, what
 * waits for the owner, the next scheduled runs, and recent activity of the active
 * project.
 */
import React from "react";
import { Link, useNavigate } from "react-router";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Eye,
  Loader,
  Play,
} from "lucide-react";
import { displaySuccessToast } from "#/utils/custom-toast-handlers";
import {
  reportFactoryError,
  useRunNow,
  useRuns,
  useWorkflows,
  type FactoryRun,
} from "./api";
import { DecisionModal } from "./decision-panel";
import { isScheduledRun, useFormatDateTime, useRunSubject } from "./describe";
import { formatDuration, since } from "./format";
import { useFactoryT } from "./i18n";
import { conversationPath, useSelectedProject } from "./project-context";
import { RunStateChip } from "./run-status";
import { isTerminal } from "./states";
import { FactoryStatusBar } from "./tickets/status-bar";
import {
  ActivityList,
  ActivityRow,
  Button,
  EmptyPanel,
  FactoryShell,
  Notice,
  OverviewTiles,
  PageHeading,
  StateMessage,
  SubHeading,
  textActionClassName,
} from "./ui";

const DAY = 86_400_000;

function RunRow({
  run,
  onDecide,
}: {
  run: FactoryRun;
  onDecide?: (id: number) => void;
}) {
  const t = useFactoryT();
  const subject = useRunSubject()(run);
  const scheduled = isScheduledRun(run);
  return (
    <ActivityRow testId={`dash-run-${run.id}`}>
      <RunStateChip state={run.state} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-content">
          <span className="font-semibold">{subject}</span>{" "}
          {scheduled ? (run.workflowName ?? run.title) : run.title}
        </span>
        <span className="truncate text-xs text-muted">
          {run.workflowName ?? run.workflow}
          {run.nodeLabel && !isTerminal(run.state) ? ` › ${run.nodeLabel}` : ""}
          {run.state === "FAILED" && run.failureMessage
            ? ` — ${run.failureMessage}`
            : ""}
        </span>
      </div>
      <span className="shrink-0 text-xs text-muted">
        {since(t, run.nodeEnteredAt ?? run.updatedAt)}
      </span>
      {run.state === "HUMAN" && onDecide && (
        <Button
          type="button"
          variant="primary"
          testId={`dash-decide-${run.id}`}
          onClick={() => onDecide(run.id)}
        >
          {t("decide")}
        </Button>
      )}
      {run.conversationId && (
        <Link
          to={conversationPath(run.project, run.conversationId)}
          className={`${textActionClassName} shrink-0`}
        >
          {t("conversation")}
        </Link>
      )}
    </ActivityRow>
  );
}

export default function DashboardPage() {
  const t = useFactoryT();
  const navigate = useNavigate();
  const fmt = useFormatDateTime();
  const { projectId, project, projects } = useSelectedProject();
  const { data: allRuns, error, isLoading } = useRuns();
  const { data: workflows } = useWorkflows(
    projectId ? { kind: "project", project: projectId } : null,
  );
  const runNow = useRunNow();
  const [review, setReview] = React.useState<number | null>(null);

  const runs = React.useMemo(
    () => (allRuns ?? []).filter((r) => !projectId || r.project === projectId),
    [allRuns, projectId],
  );
  // Reference instant of the 7/30-day windows (the page re-mounts on navigation).
  const [now] = React.useState(() => Date.now());
  const active = runs.filter((r) => ["ACTIVE", "WAITING"].includes(r.state));
  const queued = runs.filter((r) => ["QUEUED", "BLOCKED"].includes(r.state));
  const human = runs.filter((r) => r.state === "HUMAN");
  const failed7 = runs.filter(
    (r) =>
      r.state === "FAILED" && now - new Date(r.updatedAt).getTime() < 7 * DAY,
  );
  const done30 = runs.filter(
    (r) =>
      r.state === "COMPLETED" &&
      r.createdAt &&
      now - new Date(r.updatedAt).getTime() < 30 * DAY,
  );
  const avg = done30.length
    ? done30.reduce(
        (s, r) =>
          s +
          (new Date(r.updatedAt).getTime() - new Date(r.createdAt!).getTime()) /
            1000,
        0,
      ) / done30.length
    : null;
  const toHandle = [...human, ...failed7];
  const scheduled = (workflows ?? [])
    .filter((w) => w.scheduled && project?.enabledWorkflows.includes(w.id))
    .sort((a, b) => (a.nextRunAt ?? "").localeCompare(b.nextRunAt ?? ""));

  return (
    <FactoryShell>
      <PageHeading
        title={t("navDashboard")}
        description={
          project ? t("dashHint", { p: project.name }) : t("dashHintAll")
        }
        actions={
          <Button
            type="button"
            variant="secondary"
            testId="dash-open-tickets"
            onClick={() => navigate("/factory/tickets")}
          >
            {t("navTickets")}
          </Button>
        }
      />
      {!projectId && projects.length > 0 && (
        <Notice tone="info">{t("notProjectBackend")}</Notice>
      )}
      <FactoryStatusBar />
      <OverviewTiles
        label={t("navDashboard")}
        tiles={[
          {
            key: "active",
            label: t("tileActive"),
            value: String(active.length),
            detail: t("tileQueued", { n: queued.length }),
            Icon: Loader,
          },
          {
            key: "human",
            label: t("tileHuman"),
            value: String(human.length),
            detail: human.length
              ? t("tileHumanOldest", {
                  when: since(
                    t,
                    human.at(-1)?.nodeEnteredAt ?? human.at(-1)?.updatedAt,
                  ),
                })
              : t("tileNothing"),
            Icon: Eye,
          },
          {
            key: "failed",
            label: t("tileFailed"),
            value: String(failed7.length),
            detail: t("tile7days"),
            Icon: AlertTriangle,
          },
          {
            key: "duration",
            label: t("tileDuration"),
            value: formatDuration(t, avg),
            detail: t("tileDurationDetail", { n: done30.length }),
            Icon: Clock,
          },
        ]}
      />
      {isLoading && <StateMessage kind="loading" />}
      {error && (
        <StateMessage kind="error">
          {t("apiUnreachable", { msg: (error as Error).message })}
        </StateMessage>
      )}

      <section className="flex flex-col gap-3" data-testid="dash-to-handle">
        <SubHeading meta={t("toHandleHint")}>{t("toHandle")}</SubHeading>
        {toHandle.length === 0 ? (
          <EmptyPanel title={t("toHandleEmpty")} />
        ) : (
          <ActivityList>
            {toHandle.map((r) => (
              <RunRow key={r.id} run={r} onDecide={setReview} />
            ))}
          </ActivityList>
        )}
      </section>

      {scheduled.length > 0 && (
        <section className="flex flex-col gap-3" data-testid="dash-scheduled">
          <SubHeading>{t("nextScheduled")}</SubHeading>
          <ActivityList>
            {scheduled.map((w) => (
              <ActivityRow key={w.id} testId={`dash-sched-${w.id}`}>
                <CalendarClock
                  className="size-4 shrink-0 text-muted"
                  aria-hidden
                />
                <Link
                  to={`/factory/workflows/${encodeURIComponent(w.id)}`}
                  className="min-w-0 flex-1 truncate text-sm text-content hover:underline"
                >
                  {w.name}
                </Link>
                <span className="shrink-0 text-xs text-muted">
                  {w.nextRunAt ? fmt(w.nextRunAt) : "—"}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  testId={`dash-run-now-${w.id}`}
                  isDisabled={runNow.isPending}
                  startContent={<Play className="size-4" aria-hidden />}
                  onClick={() =>
                    runNow.mutate(
                      { project: projectId, id: w.id },
                      {
                        onSuccess: (r) =>
                          displaySuccessToast(
                            t("runStarted", { id: r.runId, name: w.name }),
                          ),
                        onError: reportFactoryError,
                      },
                    )
                  }
                >
                  {t("runNow")}
                </Button>
              </ActivityRow>
            ))}
          </ActivityList>
        </section>
      )}

      <section className="flex flex-col gap-3" data-testid="dash-recent">
        <SubHeading>{t("recentActivity")}</SubHeading>
        {runs.length === 0 && !isLoading ? (
          <EmptyPanel title={t("noRunsYet")} />
        ) : (
          <ActivityList>
            {runs.slice(0, 10).map((r) => (
              <RunRow key={r.id} run={r} onDecide={setReview} />
            ))}
          </ActivityList>
        )}
      </section>
      {review && (
        <DecisionModal runId={review} onClose={() => setReview(null)} />
      )}
    </FactoryShell>
  );
}
