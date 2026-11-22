/* eslint-disable i18next/no-literal-string -- factory UI is French-only */
/* eslint-disable @typescript-eslint/no-explicit-any -- node configs are validated server-side */
import React from "react";
import { cn } from "#/utils/utils";
import type { WorkflowDefinition, WorkflowNode } from "./api";

const input =
  "w-full rounded border border-border bg-surface px-2 py-1 text-sm text-foreground disabled:opacity-60";
const ID_RE = /^[a-z][a-z0-9_-]{0,47}$/;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      <span>{label}</span>
      {children}
      {hint && <span className="text-2xs opacity-80">{hint}</span>}
    </label>
  );
}

function Text({
  value,
  onChange,
  disabled,
  placeholder,
  testId,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <input
      className={input}
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={testId}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Area({
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
      className={cn(input, "font-mono text-xs")}
      rows={rows}
      value={value ?? ""}
      disabled={disabled}
      data-testid={testId}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Num({
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
      className={input}
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

function Select({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string | undefined;
  options: [string, string][];
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      className={input}
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

function Check({
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
    <label className="flex items-center gap-2 text-xs text-foreground">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

/** Raw JSON editing of the config (complex types and "advanced" for all). */
function JsonConfig({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (v: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const [text, setText] = React.useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setText(JSON.stringify(value, null, 2));
    setError(null);
  }, [value]);
  return (
    <div className="flex flex-col gap-1">
      <textarea
        className={cn(input, "font-mono text-xs")}
        rows={12}
        value={text}
        disabled={disabled}
        data-testid="wf-json-config"
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
              throw new Error("objet attendu");
            setError(null);
            onChange(parsed);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      {error && (
        <span className="text-2xs text-status-error">JSON : {error}</span>
      )}
    </div>
  );
}

// ------------------------------------------------------------ per type forms

type SetConfig = (patch: Record<string, unknown>) => void;

function TriggerForm({ c, set, ro }: { c: any; set: SetConfig; ro: boolean }) {
  const t = c.trigger ?? { kind: "manual" };
  const setT = (patch: Record<string, unknown>) =>
    set({ trigger: { ...t, ...patch } });
  const kinds: [string, string][] = [
    ["label", "Label sur l’issue"],
    ["project_status", "Statut du projet GitHub"],
    ["comment_command", "Commande /factory run dans un commentaire"],
    ["manual", "Manuel (Canvas)"],
    ["cron", "Planning (crée une issue)"],
    ["chain", "Après un autre workflow"],
  ];
  return (
    <>
      <Field label="Type de déclencheur">
        <Select
          value={t.kind}
          options={kinds}
          disabled={ro}
          onChange={(kind) => {
            const fresh: Record<string, any> = {
              label: { kind, label: "factory:ready" },
              project_status: { kind, status: "Ready" },
              comment_command: { kind, command: "run" },
              manual: { kind },
              cron: {
                kind,
                cron: "0 9 * * 1",
                timezone: "Europe/Paris",
                issueTitle: "Tâche planifiée",
                issueBody: "",
              },
              chain: { kind, workflowId: "speckit-full", result: "completed" },
            };
            set({ trigger: fresh[kind] });
          }}
        />
      </Field>
      {t.kind === "label" && (
        <>
          <Field label="Label">
            <Text
              value={t.label}
              disabled={ro}
              onChange={(label) => setT({ label })}
            />
          </Field>
          <Field label="Et statut du projet (optionnel)">
            <Text
              value={t.projectStatus}
              disabled={ro}
              onChange={(v) => setT({ projectStatus: v || undefined })}
            />
          </Field>
        </>
      )}
      {t.kind === "project_status" && (
        <Field label="Statut">
          <Text
            value={t.status}
            disabled={ro}
            onChange={(status) => setT({ status })}
          />
        </Field>
      )}
      {t.kind === "comment_command" && (
        <Field
          label="Commande"
          hint="Déclenché par « /factory run <commande> » d’un membre du dépôt."
        >
          <Text
            value={t.command}
            disabled={ro}
            onChange={(command) => setT({ command })}
          />
        </Field>
      )}
      {t.kind === "cron" && (
        <>
          <Field
            label="Expression cron"
            hint="minute heure jour mois jour-semaine"
          >
            <Text
              value={t.cron}
              disabled={ro}
              onChange={(cron) => setT({ cron })}
            />
          </Field>
          <Field label="Fuseau">
            <Text
              value={t.timezone}
              disabled={ro}
              onChange={(timezone) => setT({ timezone })}
            />
          </Field>
          <Field label="Titre de l’issue créée">
            <Text
              value={t.issueTitle}
              disabled={ro}
              onChange={(issueTitle) => setT({ issueTitle })}
            />
          </Field>
          <Field label="Corps de l’issue">
            <Area
              value={t.issueBody}
              rows={4}
              disabled={ro}
              onChange={(issueBody) => setT({ issueBody })}
            />
          </Field>
        </>
      )}
      {t.kind === "chain" && (
        <>
          <Field label="Workflow précédent (id)">
            <Text
              value={t.workflowId}
              disabled={ro}
              onChange={(workflowId) => setT({ workflowId })}
            />
          </Field>
          <Field label="Quand il se termine par">
            <Select
              value={t.result}
              disabled={ro}
              options={[
                ["completed", "terminé"],
                ["failed", "échec"],
                ["cancelled", "annulé"],
                ["any", "n’importe quel résultat"],
              ]}
              onChange={(result) => setT({ result })}
            />
          </Field>
        </>
      )}
    </>
  );
}

function OutcomesEditor({
  c,
  set,
  ro,
}: {
  c: any;
  set: SetConfig;
  ro: boolean;
}) {
  const outcomes: any[] = c.outcomes ?? [];
  const update = (i: number, patch: Record<string, unknown>) =>
    set({
      outcomes: outcomes.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    });
  return (
    <div className="flex flex-col gap-2" data-testid="wf-outcomes">
      <span className="text-xs text-muted">Choix (une sortie par choix)</span>
      {outcomes.map((o, i) => (
        <div
          key={i}
          className="flex flex-col gap-1 rounded border border-border p-2"
        >
          <div className="flex gap-1">
            <input
              className={cn(input, "w-28 font-mono")}
              value={o.id}
              disabled={ro}
              title="identifiant (sortie)"
              onChange={(e) => update(i, { id: e.target.value })}
            />
            <input
              className={input}
              value={o.label}
              disabled={ro}
              title="libellé du bouton"
              onChange={(e) => update(i, { label: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              className={cn(input, "w-36")}
              value={o.kind}
              disabled={ro}
              onChange={(e) => update(i, { kind: e.target.value })}
            >
              <option value="approve">approbation</option>
              <option value="changes">changements</option>
              <option value="reject">rejet</option>
              <option value="other">autre</option>
            </select>
            <Check
              label="remarque obligatoire"
              checked={!!o.requireComment}
              disabled={ro}
              onChange={(requireComment) => update(i, { requireComment })}
            />
            {!ro && outcomes.length > 1 && (
              <button
                type="button"
                className="ml-auto text-xs text-status-error"
                onClick={() =>
                  set({ outcomes: outcomes.filter((_, j) => j !== i) })
                }
              >
                Supprimer
              </button>
            )}
          </div>
        </div>
      ))}
      {!ro && outcomes.length < 8 && (
        <button
          type="button"
          className="self-start text-xs text-muted hover:text-foreground"
          onClick={() =>
            set({
              outcomes: [
                ...outcomes,
                {
                  id: `choix_${outcomes.length + 1}`,
                  label: "Nouveau choix",
                  kind: "other",
                  requireComment: false,
                },
              ],
            })
          }
        >
          + Ajouter un choix
        </button>
      )}
    </div>
  );
}

function TypeForm({
  node,
  set,
  ro,
  commands,
}: {
  node: WorkflowNode;
  set: SetConfig;
  ro: boolean;
  commands: string[];
}) {
  const c = node.config as any;
  switch (node.type) {
    case "trigger":
      return <TriggerForm c={c} set={set} ro={ro} />;
    case "agent":
      return (
        <>
          <Field
            label="Consigne"
            hint="Variables : {{ticket.title}}, {{ticket.body}}, {{paths.specs}}, {{feedback}}…"
          >
            <Area
              value={c.prompt}
              rows={10}
              disabled={ro}
              testId="wf-agent-prompt"
              onChange={(prompt) => set({ prompt })}
            />
          </Field>
          <Field
            label="Consigne aux passages suivants (optionnel)"
            hint="{{feedback}} contient les problèmes ou remarques."
          >
            <Area
              value={c.revisitPrompt}
              rows={5}
              disabled={ro}
              onChange={(v) => set({ revisitPrompt: v || undefined })}
            />
          </Field>
          <Field label="Conversation">
            <Select
              value={c.conversation ?? "ticket"}
              disabled={ro}
              options={[
                ["ticket", "celle du ticket"],
                ["new", "nouvelle (relecteur indépendant)"],
              ]}
              onChange={(conversation) => set({ conversation })}
            />
          </Field>
        </>
      );
    case "command":
      return (
        <Field
          label="Commandes du projet (dans l’ordre, séparées par des virgules)"
          hint={
            commands.length ? `Disponibles : ${commands.join(", ")}` : undefined
          }
        >
          <Text
            value={(c.commands ?? []).join(", ")}
            disabled={ro}
            onChange={(v) =>
              set({
                commands: v
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
      );
    case "human":
      return (
        <>
          <Field label="Titre">
            <Text
              value={c.title}
              disabled={ro}
              onChange={(title) => set({ title })}
            />
          </Field>
          <Field label="Ce qui est à valider" hint="ex. « la spécification »">
            <Text
              value={c.what}
              disabled={ro}
              onChange={(what) => set({ what })}
            />
          </Field>
          <Field label="Fichiers à relire (un par ligne, relatifs au ticket)">
            <Area
              value={(c.files ?? []).join("\n")}
              rows={3}
              disabled={ro}
              onChange={(v) =>
                set({
                  files: v
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label="Instructions">
            <Area
              value={c.instructions}
              rows={3}
              disabled={ro}
              onChange={(v) => set({ instructions: v || undefined })}
            />
          </Field>
          <OutcomesEditor c={c} set={set} ro={ro} />
          <Field label="Validateurs distincts requis">
            <Num
              value={c.quorum ?? 1}
              min={1}
              max={5}
              disabled={ro}
              onChange={(quorum) => set({ quorum: quorum ?? 1 })}
            />
          </Field>
          <Check
            label="Publier les fichiers sur l’issue"
            checked={c.postFilesToIssue !== false}
            disabled={ro}
            onChange={(postFilesToIssue) => set({ postFilesToIssue })}
          />
        </>
      );
    case "git": {
      const actions: [string, string][] = [
        ["push", "Pousser la branche factory/*"],
        ["draft_pr", "Ouvrir / mettre à jour la PR brouillon"],
        ["ready_pr", "Passer la PR en « prête » (après validation humaine)"],
        ["comment", "Commenter l’issue"],
        ["add_label", "Ajouter un label"],
        ["remove_label", "Retirer un label"],
      ];
      return (
        <>
          <Field label="Action">
            <Select
              value={c.action}
              options={actions}
              disabled={ro}
              onChange={(action) =>
                set({
                  action,
                  title: undefined,
                  text: action === "comment" ? "Commentaire" : undefined,
                  label: action.endsWith("_label")
                    ? "factory:label"
                    : undefined,
                })
              }
            />
          </Field>
          {c.action === "draft_pr" && (
            <Field label="Titre de la PR (optionnel)">
              <Text
                value={c.title}
                disabled={ro}
                onChange={(v) => set({ title: v || undefined })}
              />
            </Field>
          )}
          {c.action === "comment" && (
            <Field label="Texte">
              <Area
                value={c.text}
                rows={4}
                disabled={ro}
                onChange={(text) => set({ text })}
              />
            </Field>
          )}
          {(c.action === "add_label" || c.action === "remove_label") && (
            <Field label="Label">
              <Text
                value={c.label}
                disabled={ro}
                onChange={(label) => set({ label })}
              />
            </Field>
          )}
        </>
      );
    }
    case "wait":
      return (
        <>
          <Field label="Attendre">
            <Select
              value={c.for}
              disabled={ro}
              options={[
                ["pr_merged", "le merge de la PR (par un humain)"],
                ["ci", "le résultat de la CI"],
                ["duration", "une durée"],
              ]}
              onChange={(f) =>
                set(
                  f === "duration"
                    ? { for: f, minutes: 60 }
                    : { for: f, minutes: undefined },
                )
              }
            />
          </Field>
          {c.for === "duration" && (
            <Field label="Minutes">
              <Num
                value={c.minutes}
                min={1}
                disabled={ro}
                onChange={(minutes) => set({ minutes })}
              />
            </Field>
          )}
        </>
      );
    case "note":
      return (
        <>
          <Field label="Message">
            <Area
              value={c.text}
              rows={4}
              disabled={ro}
              onChange={(text) => set({ text })}
            />
          </Field>
          <Field label="Destination">
            <Select
              value={c.to ?? "canvas"}
              disabled={ro}
              options={[
                ["canvas", "conversation Canvas"],
                ["issue", "issue GitHub"],
                ["both", "les deux"],
              ]}
              onChange={(to) => set({ to })}
            />
          </Field>
        </>
      );
    case "end":
      return (
        <>
          <Field label="Résultat">
            <Select
              value={c.result}
              disabled={ro}
              options={[
                ["completed", "terminé"],
                ["failed", "échec"],
                ["cancelled", "annulé"],
              ]}
              onChange={(result) => set({ result })}
            />
          </Field>
          <Field label="Message (optionnel)">
            <Text
              value={c.message}
              disabled={ro}
              onChange={(v) => set({ message: v || undefined })}
            />
          </Field>
        </>
      );
    default:
      // check, router: structured lists edited as JSON (validated server-side).
      return null;
  }
}

// ------------------------------------------------------------------ panels

export function NodeInspector({
  node,
  readOnly,
  commands,
  problems,
  onChange,
  onRename,
  onDelete,
}: {
  node: WorkflowNode;
  readOnly: boolean;
  commands: string[];
  problems: string[];
  onChange: (n: WorkflowNode) => void;
  onRename: (newId: string) => void;
  onDelete: () => void;
}) {
  const [idDraft, setIdDraft] = React.useState(node.id);
  const [advanced, setAdvanced] = React.useState(
    node.type === "check" || node.type === "router",
  );
  React.useEffect(() => {
    setIdDraft(node.id);
    setAdvanced(node.type === "check" || node.type === "router");
  }, [node.id, node.type]);
  const set: SetConfig = (patch) => {
    const config = { ...node.config, ...patch };
    for (const k of Object.keys(config))
      if (config[k] === undefined) delete config[k];
    onChange({ ...node, config });
  };
  const setBase = (patch: Partial<WorkflowNode>) => {
    const n = { ...node, ...patch } as Record<string, unknown>;
    for (const k of Object.keys(n)) if (n[k] === undefined) delete n[k];
    onChange(n as unknown as WorkflowNode);
  };
  const idValid = ID_RE.test(idDraft);
  return (
    <div className="flex flex-col gap-3" data-testid="wf-inspector">
      {problems.length > 0 && (
        <ul className="rounded border border-status-error p-2 text-xs text-status-error">
          {problems.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      )}
      <Field
        label="Identifiant"
        hint={idValid ? undefined : "minuscules, chiffres, - ou _"}
      >
        <input
          className={cn(input, "font-mono", !idValid && "border-status-error")}
          value={idDraft}
          disabled={readOnly}
          data-testid="wf-node-id"
          onChange={(e) => setIdDraft(e.target.value)}
          onBlur={() => {
            if (idDraft !== node.id && idValid) onRename(idDraft);
            else setIdDraft(node.id);
          }}
        />
      </Field>
      <Field label="Libellé">
        <Text
          value={node.label}
          disabled={readOnly}
          onChange={(v) => setBase({ label: v || undefined })}
        />
      </Field>
      <TypeForm node={node} set={set} ro={readOnly} commands={commands} />
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">Options du nœud</summary>
        <div className="mt-2 flex flex-col gap-2">
          <Field
            label="Passages maximum"
            hint="Obligatoire sur au moins un nœud de chaque boucle."
          >
            <Num
              value={node.maxVisits}
              min={1}
              max={20}
              disabled={readOnly}
              onChange={(maxVisits) => setBase({ maxVisits })}
            />
          </Field>
          <Field label="Délai (minutes)" hint="Ajoute une sortie « timeout ».">
            <Num
              value={node.timeoutMinutes}
              min={1}
              disabled={readOnly}
              onChange={(timeoutMinutes) => setBase({ timeoutMinutes })}
            />
          </Field>
          <Field label="Colonne du projet GitHub pendant ce nœud">
            <Text
              value={node.board}
              disabled={readOnly}
              onChange={(v) => setBase({ board: v || undefined })}
            />
          </Field>
        </div>
      </details>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          className="self-start text-xs text-muted hover:text-foreground"
          onClick={() => setAdvanced((a) => !a)}
        >
          {advanced ? "▾" : "▸"} Configuration JSON
        </button>
        {advanced && (
          <JsonConfig
            value={node.config}
            disabled={readOnly}
            onChange={(config) => onChange({ ...node, config })}
          />
        )}
      </div>
      {!readOnly && (
        <button
          type="button"
          className="self-start text-xs text-status-error"
          onClick={onDelete}
          data-testid="wf-delete-node"
        >
          Supprimer le nœud
        </button>
      )}
    </div>
  );
}

export function WorkflowSettings({
  def,
  readOnly,
  onChange,
}: {
  def: WorkflowDefinition;
  readOnly: boolean;
  onChange: (d: WorkflowDefinition) => void;
}) {
  const s = def.settings;
  const setS = (patch: Partial<WorkflowDefinition["settings"]>) =>
    onChange({ ...def, settings: { ...s, ...patch } });
  return (
    <div className="flex flex-col gap-3" data-testid="wf-settings">
      <Field label="Nom">
        <Text
          value={def.name}
          disabled={readOnly}
          testId="wf-name"
          onChange={(name) => onChange({ ...def, name })}
        />
      </Field>
      <Field label="Description">
        <Area
          value={def.description}
          rows={3}
          disabled={readOnly}
          onChange={(description) => onChange({ ...def, description })}
        />
      </Field>
      <Field label="Si un run est déjà ouvert sur l’issue">
        <Select
          value={s.onExisting}
          disabled={readOnly}
          options={[
            ["ignore", "ignorer le déclencheur"],
            ["restart", "annuler et redémarrer"],
          ]}
          onChange={(v) => setS({ onExisting: v as "ignore" | "restart" })}
        />
      </Field>
      <Check
        label="Annuler si le label déclencheur est retiré (avant la PR)"
        checked={s.cancelOnLabelRemoved}
        disabled={readOnly}
        onChange={(v) => setS({ cancelOnLabelRemoved: v })}
      />
      <Check
        label="Annuler si l’issue est fermée"
        checked={s.cancelOnIssueClosed}
        disabled={readOnly}
        onChange={(v) => setS({ cancelOnIssueClosed: v })}
      />
      <Check
        label="Environnement SpecKit (specs hors du dépôt)"
        checked={s.speckit}
        disabled={readOnly}
        onChange={(v) => setS({ speckit: v })}
      />
      <p className="text-2xs text-muted">
        Clique sur un nœud pour le modifier. Glisse depuis une sortie (à droite
        d’un nœud) vers l’entrée d’un autre pour les relier. Suppr efface la
        sélection.
      </p>
    </div>
  );
}
