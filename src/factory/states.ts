/** Run states of the orchestrator, as shown everywhere in the factory UI (one source). */
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Eye,
  Hourglass,
  Loader,
  PauseCircle,
  XCircle,
} from "lucide-react";
import type { StatusTone } from "#/utils/status-tone-classes";
import type { FactoryKey } from "./i18n";

export const RUN_STATES = [
  "QUEUED",
  "BLOCKED",
  "ACTIVE",
  "HUMAN",
  "WAITING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type RunState = (typeof RUN_STATES)[number];

export const TERMINAL_STATES: readonly string[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export function isTerminal(state: string): boolean {
  return TERMINAL_STATES.includes(state);
}

interface StateLook {
  label: FactoryKey;
  tone: StatusTone | "neutral";
  Icon: LucideIcon;
}

const LOOK: Record<RunState, StateLook> = {
  QUEUED: { label: "stateQUEUED", tone: "neutral", Icon: CircleDashed },
  BLOCKED: { label: "stateBLOCKED", tone: "neutral", Icon: Ban },
  ACTIVE: { label: "stateACTIVE", tone: "info", Icon: Loader },
  HUMAN: { label: "stateHUMAN", tone: "warning", Icon: Eye },
  WAITING: { label: "stateWAITING", tone: "neutral", Icon: Hourglass },
  COMPLETED: { label: "stateCOMPLETED", tone: "success", Icon: CheckCircle2 },
  FAILED: { label: "stateFAILED", tone: "danger", Icon: XCircle },
  CANCELLED: { label: "stateCANCELLED", tone: "neutral", Icon: PauseCircle },
};

export function stateLook(state: string): StateLook {
  return LOOK[state as RunState] ?? LOOK.ACTIVE;
}
