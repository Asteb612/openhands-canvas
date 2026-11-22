/**
 * Dialog asking for a new workflow identifier (new, duplicate, create from a template,
 * publish as a template), optionally with a source template to pick.
 */
import React from "react";
import { X } from "lucide-react";
import { cn } from "#/utils/utils";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import type { WorkflowSummary } from "../api";
import { useFactoryT } from "../i18n";
import { Button, Field, fieldClassName, selectClassName } from "../ui";
import { ID_RE } from "./inspector-fields";

export function IdDialog({
  title,
  description,
  submitLabel,
  initialId = "",
  takenIds,
  existing,
  templates,
  busy,
  onSubmit,
  onClose,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  initialId?: string;
  /** Identifiers already used in the target scope. */
  takenIds: string[];
  /** Identifiers allowed but worth a warning (e.g. publishing over an existing template). */
  existing?: { ids: string[]; hint: (id: string) => string };
  /** When set, a template must be picked first (its id is proposed as the new id). */
  templates?: WorkflowSummary[];
  busy: boolean;
  onSubmit: (v: { id: string; template: string }) => void;
  onClose: () => void;
}) {
  const t = useFactoryT();
  const [template, setTemplate] = React.useState("");
  const [id, setId] = React.useState(initialId);
  const taken = takenIds.includes(id);
  const valid = ID_RE.test(id) && !taken && (!templates || !!template);
  let hint = t("wfIdRule");
  if (taken) hint = t("wfIdTaken", { id });
  else if (existing?.ids.includes(id)) hint = existing.hint(id);
  return (
    <ModalBackdrop onClose={onClose} aria-label={title}>
      <form
        className="flex w-[min(28rem,92vw)] flex-col gap-4 rounded-xl border border-border bg-base-secondary p-5"
        data-testid="wf-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) onSubmit({ id, template });
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-medium text-content">{title}</h2>
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel")}
            className="cursor-pointer text-muted hover:text-content"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {templates && (
          <Field label={t("wfTemplate")}>
            <select
              className={selectClassName}
              value={template}
              data-testid="wf-dialog-template"
              onChange={(e) => {
                const next = e.target.value;
                setTemplate(next);
                if (!id || id === template)
                  setId(takenIds.includes(next) ? "" : next);
              }}
            >
              <option value="">{t("wfPickTemplate")}</option>
              {templates.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={t("wfNewId")} hint={hint}>
          <input
            className={cn(
              fieldClassName,
              "font-mono",
              (taken || (id && !ID_RE.test(id))) && "border-danger",
            )}
            value={id}
            data-testid="wf-dialog-id"
            onChange={(e) => setId(e.target.value.trim())}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isDisabled={!valid || busy}
            testId="wf-dialog-submit"
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </ModalBackdrop>
  );
}
