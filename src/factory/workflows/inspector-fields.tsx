/** Form controls of the node inspector, built on the factory kit's classes. */
import React from "react";
import { cn } from "#/utils/utils";
import { useFactoryT } from "../i18n";
import {
  Switch,
  fieldClassName,
  selectClassName,
  textareaClassName,
} from "../ui";

/** Partial update of a node's config (undefined values are removed). */
export type SetConfig = (patch: Record<string, unknown>) => void;

export const ID_RE = /^[a-z][a-z0-9_-]{0,47}$/;

export function Text({
  value,
  onChange,
  disabled,
  placeholder,
  testId,
  className,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder?: string;
  testId?: string;
  className?: string;
}) {
  return (
    <input
      className={cn(fieldClassName, className)}
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={testId}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Area({
  value,
  onChange,
  disabled,
  rows = 6,
  testId,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  disabled: boolean;
  rows?: number;
  testId?: string;
}) {
  return (
    <textarea
      className={cn(textareaClassName, "font-mono text-xs")}
      rows={rows}
      value={value ?? ""}
      disabled={disabled}
      data-testid={testId}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Num({
  value,
  onChange,
  disabled,
  min,
  max,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  disabled: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      className={fieldClassName}
      value={value ?? ""}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) =>
        onChange(e.target.value === "" ? undefined : Number(e.target.value))
      }
    />
  );
}

export function Select({
  value,
  options,
  onChange,
  disabled,
  className,
  testId,
}: {
  value: string | undefined;
  options: [string, string][];
  onChange: (v: string) => void;
  disabled: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <select
      data-testid={testId}
      className={cn(selectClassName, className)}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function Check({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <Switch isToggled={checked} isDisabled={disabled} onToggle={onChange}>
      {label}
    </Switch>
  );
}

/** Raw JSON editing of the config (complex types and "advanced" for all). */
export function JsonConfig({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (v: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const t = useFactoryT();
  const [text, setText] = React.useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setText(JSON.stringify(value, null, 2));
    setError(null);
  }, [value]);
  return (
    <div className="flex flex-col gap-1">
      <textarea
        className={cn(textareaClassName, "font-mono text-xs")}
        rows={12}
        value={text}
        disabled={disabled}
        data-testid="wf-json-config"
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            if (
              !parsed ||
              typeof parsed !== "object" ||
              Array.isArray(parsed)
            ) {
              setError(t("wfJsonObjectExpected"));
              return;
            }
            setError(null);
            onChange(parsed);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      {error && (
        <span className="text-xs text-danger">
          {t("wfJsonError", { error })}
        </span>
      )}
    </div>
  );
}
