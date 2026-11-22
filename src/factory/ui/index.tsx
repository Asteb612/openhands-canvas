/**
 * Factory UI kit: the factory screens are built from the same pieces as the rest of
 * Canvas (BrandButton, form-control classes, SettingsSwitch, ConfirmationModal, status
 * tones, LoadingSpinner), never from local copies of their styles.
 */
import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "#/utils/utils";
import {
  formControlFieldClassName,
  formControlMultilineFieldClassName,
} from "#/utils/form-control-classes";
import {
  statusToneBadgeClassName,
  statusToneBannerClassName,
  type StatusTone,
} from "#/utils/status-tone-classes";
import { LoadingSpinner } from "#/components/shared/loading-spinner";
import { ConfirmationModal } from "#/components/shared/modals/confirmation-modal";
import { useFactoryT } from "../i18n";

export { BrandButton as Button } from "#/components/features/settings/brand-button";
export { SettingsSwitch as Switch } from "#/components/features/settings/settings-switch";
export type { StatusTone };

/** Single-line field, select and multiline field: the Canvas form controls. */
export const fieldClassName = formControlFieldClassName;
export const selectClassName = cn(
  formControlFieldClassName,
  "cursor-pointer pr-8",
);
export const textareaClassName = formControlMultilineFieldClassName;
/** Discreet text action in dense places (cards, toolbars). */
export const textActionClassName =
  "cursor-pointer text-sm text-muted underline-offset-2 hover:text-content hover:underline disabled:cursor-not-allowed disabled:opacity-50";

/** A titled block of a settings-like page. */
export function Section({
  title,
  description,
  actions,
  children,
  testId,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section
      className="rounded-2xl border border-border bg-surface"
      data-testid={testId}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-5 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-medium text-content">{title}</h2>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="flex flex-col gap-3 px-5 py-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-sm text-content">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Small status pill (run states, project status...). */
export function Pill({
  tone,
  icon,
  children,
  testId,
  title,
}: {
  tone?: StatusTone | "neutral";
  icon?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
  title?: string;
}) {
  return (
    <span
      data-testid={testId}
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 text-xs leading-5",
        !tone || tone === "neutral"
          ? "bg-surface-raised text-muted"
          : statusToneBadgeClassName[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Notice({
  tone,
  children,
  testId,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        statusToneBannerClassName[tone],
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** Loading / error / empty, the same everywhere. */
export function StateMessage({
  kind,
  children,
}: {
  kind: "loading" | "error" | "empty";
  children?: React.ReactNode;
}) {
  const t = useFactoryT();
  if (kind === "loading")
    return (
      <div
        className="flex items-center gap-2 py-6 text-sm text-muted"
        role="status"
      >
        <LoadingSpinner size="small" />
        {children ?? t("loading")}
      </div>
    );
  if (kind === "error")
    return (
      <Notice tone="danger">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{children}</span>
      </Notice>
    );
  return (
    <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted">
      {children}
    </p>
  );
}

/**
 * Confirmation for consequential actions (approve, pause, retry...): the Canvas modal,
 * not a "click twice" button.
 */
export function useConfirm() {
  const [pending, setPending] = React.useState<{
    text: string;
    confirmText?: string;
    body?: React.ReactNode;
    onConfirm: () => void;
  } | null>(null);
  const ask = React.useCallback(
    (
      text: string,
      onConfirm: () => void,
      opts: { confirmText?: string; body?: React.ReactNode } = {},
    ) => setPending({ text, onConfirm, ...opts }),
    [],
  );
  const modal = pending ? (
    <ConfirmationModal
      text={pending.text}
      confirmText={pending.confirmText}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const run = pending.onConfirm;
        setPending(null);
        run();
      }}
    >
      {pending.body}
    </ConfirmationModal>
  ) : null;
  return { ask, modal };
}

export * from "./shell";
