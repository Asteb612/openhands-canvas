/**
 * Factory strings, French and English, following Canvas' language setting (i18next's
 * current language; anything other than French falls back to English). Kept out of
 * the upstream translation.json, which requires all 16 Canvas languages per key.
 *
 * One table: every key has both languages, so a missing translation is a type error.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { WORKFLOW_STRINGS } from "./workflows/strings";

const BASE = {
  // common
  loading: ["Chargement…", "Loading…"],
  apiUnreachable: [
    "API de la factory injoignable : {msg}",
    "Factory API unreachable: {msg}",
  ],
  cancel: ["Annuler", "Cancel"],
  save: ["Enregistrer", "Save"],
  confirm: ["Confirmer", "Confirm"],
  none: ["Rien", "Nothing"],
  allProjects: ["Tous les projets", "All projects"],
  project: ["Projet", "Project"],
  chooseProject: [
    "Choisis un projet dans la barre latérale.",
    "Pick a project in the sidebar.",
  ],
  inactive: ["inactif", "inactive"],
  inError: ["en erreur", "error"],
  paused: ["en pause", "paused"],
  // navigation
  navTickets: ["Tickets", "Tickets"],
  navWorkflows: ["Workflows", "Workflows"],
  navProject: ["Projet", "Project"],
  navGroup: ["Factory", "Factory"],
  // run states
  stateQUEUED: ["en file", "queued"],
  stateBLOCKED: ["bloqué", "blocked"],
  stateACTIVE: ["en cours", "running"],
  stateHUMAN: ["à valider", "to review"],
  stateWAITING: ["en attente", "waiting"],
  stateCOMPLETED: ["terminé", "done"],
  stateFAILED: ["échec", "failed"],
  stateCANCELLED: ["annulé", "cancelled"],
  // durations
  justNow: ["à l'instant", "just now"],
  minutes: ["{n} min", "{n} min"],
  hours: ["{n} h", "{n} h"],
  hoursMinutes: ["{h} h {m}", "{h} h {m}"],
  days: ["{n} j", "{n} d"],
  daysHours: ["{d} j {h} h", "{d} d {h} h"],
  seconds: ["{n} s", "{n} s"],
  // tickets page
  ticketsTitle: ["Tickets", "Tickets"],
  decisionsWaiting: ["{n} décision(s) attendue(s)", "{n} decision(s) waiting"],
  projectColumns: ["colonnes du projet", "project columns"],
  search: ["Rechercher (#, titre, étape)", "Search (#, title, step)"],
  allWorkflows: ["Tous les workflows", "All workflows"],
  configure: ["Configurer", "Configure"],
  newTicket: ["Nouveau ticket", "New ticket"],
  startOnIssue: ["Lancer sur une issue", "Start on an issue"],
  colHuman: ["À valider", "To review"],
  colHumanHint: ["une décision t'attend", "a decision is waiting for you"],
  colActive: ["En cours", "In progress"],
  colActiveHint: [
    "l'agent travaille ou attend un évènement",
    "the agent works or waits for an event",
  ],
  colQueued: ["En file", "Queued"],
  colQueuedHint: ["pas encore pris en charge", "not picked up yet"],
  colFailed: ["Échec", "Failed"],
  colFailedHint: ["à relancer ou abandonner", "retry or give up"],
  colDone: ["Terminés", "Done"],
  colDoneHint: ["terminés ou annulés", "completed or cancelled"],
  colOther: ["Autres", "Other"],
  colOtherHint: ["aucune colonne ne correspond", "no column matches"],
  showMore: ["Voir les {n} autres", "Show {n} more"],
  showLess: ["Réduire", "Show less"],
  decide: ["Décider", "Decide"],
  conversation: ["Conversation", "Conversation"],
  workflow: ["Workflow", "Workflow"],
  retry: ["Relancer", "Retry"],
  retryConfirm: [
    "Relancer #{issue} avec le workflow {wf} ?",
    "Retry #{issue} with workflow {wf}?",
  ],
  retried: ["#{issue} relancé", "#{issue} restarted"],
  opensWhenPicked: [
    "La conversation s'ouvrira à la prise en charge.",
    "The conversation opens when the factory picks it up.",
  ],
  otherProject: ["projet {p}", "project {p}"],
  // new ticket
  taskType: ["Type de tâche", "Task type"],
  description: [
    "Description (1re ligne = titre de l'issue GitHub)",
    "Description (first line = GitHub issue title)",
  ],
  createAndStart: ["Créer l'issue et lancer", "Create the issue and start"],
  ticketCreated: [
    "Ticket #{issue} créé. La conversation s'ouvre dès que la factory le prend en charge.",
    "Ticket #{issue} created. Its conversation opens when the factory picks it up.",
  ],
  titleTooShort: [
    "La première ligne (titre de l'issue) est trop courte.",
    "The first line (issue title) is too short.",
  ],
  noActiveProject: [
    "Aucun projet actif : impossible de créer un ticket.",
    "No running project: cannot create a ticket.",
  ],
  issueNumber: ["n° d'issue", "issue #"],
  start: ["Démarrer", "Start"],
  runCreated: [
    "Run {run} créé pour #{issue}.",
    "Run {run} created for #{issue}.",
  ],
  // task type picker
  freeChat: ["Chat libre", "Plain chat"],
  freeChatHint: [
    "Une conversation normale, sans ticket ni workflow.",
    "A normal conversation, no ticket nor workflow.",
  ],
  factoryTicketOf: ["Ticket factory · {repo}", "Factory ticket · {repo}"],
  byDefault: ["{name} (par défaut)", "{name} (default)"],
  factoryTicketHint: [
    "Ticket factory : le message devient une issue GitHub (1re ligne = titre) et le workflow démarre dessus.",
    "Factory ticket: the message becomes a GitHub issue (first line = title) and the workflow starts on it.",
  ],
  composerPlaceholder: [
    "Décris la tâche : la 1re ligne devient le titre de l'issue",
    "Describe the task: the first line becomes the issue title",
  ],
  noAttachments: [
    "Les pièces jointes ne passent pas par la factory : mets un lien dans le texte.",
    "Attachments do not go through the factory: put a link in the text.",
  ],
  // status bar
  factoryActive: [
    "Factory active · {n} agent(s) en cours",
    "Factory running · {n} agent(s) working",
  ],
  factoryPaused: ["Factory en pause (par {by})", "Factory paused (by {by})"],
  pauseAll: ["Tout mettre en pause", "Pause everything"],
  pauseAllConfirm: [
    "Mettre toute la factory en pause ? Aucune nouvelle étape ne sera envoyée, pour aucun projet (les tours d'agent en cours se terminent).",
    "Pause the whole factory? No new step is sent for any project (running agent turns finish).",
  ],
  resume: ["Reprendre", "Resume"],
  pausedToast: ["Factory en pause", "Factory paused"],
  resumedToast: ["Factory relancée", "Factory resumed"],
  quotaOk: ["{label} : quota OK", "{label}: quota OK"],
  quotaHit: [
    "{label} : quota atteint, reprise vers {time} ({projects})",
    "{label}: quota reached, resumes around {time} ({projects})",
  ],
  pushOn: ["Push ntfy actif", "ntfy push on"],
  pushOff: ["Push non configuré", "Push not configured"],
  browserNotifyOn: [
    "Notifications du navigateur : oui",
    "Browser notifications: on",
  ],
  browserNotifyOff: ["Activer les notifications", "Turn notifications on"],
  notifyDenied: [
    "Notifications refusées par le navigateur (réglage du site).",
    "Notifications blocked by the browser (site setting).",
  ],
  // decision
  decisionTitle: ["Décision", "Decision"],
  openConversation: ["Ouvrir la conversation", "Open the conversation"],
  noReviewFiles: [
    "Cette étape ne liste aucun fichier : voir la conversation.",
    "This step lists no file: see the conversation.",
  ],
  fileMissing: [
    "Fichier absent du workspace du ticket.",
    "File missing from the ticket workspace.",
  ],
  truncated: [
    "(tronqué : la suite est dans la conversation)",
    "(truncated: the rest is in the conversation)",
  ],
  comment: [
    "Commentaire (transmis à l'agent avec la décision)",
    "Comment (sent to the agent with the decision)",
  ],
  commentRequired: [
    "« {label} » demande un commentaire.",
    "“{label}” needs a comment.",
  ],
  decideConfirm: ["{label} : {what} ?", "{label}: {what}?"],
  decisionSent: [
    "{label} envoyé. La factory l'applique au prochain passage.",
    "{label} sent. The factory applies it on its next pass.",
  ],
  decisionWaiting: [
    "Décision attendue sur {what}",
    "Decision waiting on {what}",
  ],
  approvedFiles: ["Fichiers à relire", "Files to review"],
  // banner
  showGraph: ["Voir le graphe", "Show graph"],
  hideGraph: ["Masquer le graphe", "Hide graph"],
  editWorkflow: ["Modifier le workflow", "Edit the workflow"],
  draft: ["(brouillon)", "(draft)"],
  graphUnavailable: [
    "Graphe indisponible (API de la factory injoignable).",
    "Graph unavailable (factory API unreachable).",
  ],
  // project page
  projectTitle: ["Projet", "Project"],
  projectError: [
    "Ce projet est désactivé : {error}",
    "This project is disabled: {error}",
  ],
  projectInactive: [
    "Projet inactif (active: false dans son fichier) : aucun run n'est lancé.",
    "Inactive project (active: false in its file): no run starts.",
  ],
  projectPausedBy: [
    "En pause depuis {at} par {by}",
    "Paused since {at} by {by}",
  ],
  pauseProject: ["Mettre le projet en pause", "Pause the project"],
  pauseProjectConfirm: [
    "Mettre {p} en pause ? Plus aucune étape n'est envoyée pour ce projet jusqu'à la reprise.",
    "Pause {p}? No step is sent for this project until resumed.",
  ],
  resumeProject: ["Reprendre le projet", "Resume the project"],
  workflowsSection: ["Workflows du projet", "Project workflows"],
  workflowsSectionHint: [
    "Ceux proposés comme type de tâche et dont les déclencheurs s'appliquent. Le workflow par défaut démarre sur le label « prêt ».",
    "Offered as task types, with their triggers applied. The default one starts on the ready label.",
  ],
  enabled: ["Activé", "Enabled"],
  defaultCol: ["Par défaut", "Default"],
  workflowsSaved: [
    "Workflows du projet enregistrés",
    "Project workflows saved",
  ],
  columnsSection: ["Colonnes du tableau Tickets", "Tickets board columns"],
  columnsHint: [
    "Un ticket va dans la première colonne dont tous les filtres correspondent (états et étapes ; vide = tout). Les autres vont dans « Autres ».",
    "A ticket goes to the first column whose filters all match (states and steps; empty = any). The rest go to “Other”.",
  ],
  columnTitle: ["Titre", "Title"],
  columnHint: ["Aide (sous le titre)", "Hint (under the title)"],
  states: ["États", "States"],
  steps: ["Étapes", "Steps"],
  any: ["(tous)", "(any)"],
  anyStep: ["(toutes)", "(any)"],
  addStep: ["+ étape…", "+ step…"],
  anyStepNamed: ["toute étape « {id} »", "any step “{id}”"],
  addColumn: ["+ Colonne", "+ Column"],
  newColumn: ["Nouvelle colonne", "New column"],
  defaultColumns: ["Colonnes par défaut", "Default columns"],
  saveColumns: ["Enregistrer les colonnes", "Save columns"],
  columnsSaved: ["Colonnes enregistrées", "Columns saved"],
  moveUp: ["Monter", "Move up"],
  moveDown: ["Descendre", "Move down"],
  remove: ["Supprimer {name}", "Remove {name}"],
  notificationsSection: ["Notifications", "Notifications"],
  notificationsHint: [
    "Navigateur : tant qu'un onglet Canvas est ouvert (tous projets). Push ntfy : même onglet fermé, envoyé par l'orchestrateur.",
    "Browser: while a Canvas tab is open (all projects). ntfy push: even with the tab closed, sent by the orchestrator.",
  ],
  browserThisDevice: [
    "Notifications du navigateur (cet appareil)",
    "Browser notifications (this device)",
  ],
  pushEvents: ["Évènements envoyés en push", "Events pushed"],
  pushTopic: ["Topic du projet : {env}", "Project topic: {env}"],
  pushGlobalTopic: [
    "Topic global (FACTORY_NTFY_URL)",
    "Global topic (FACTORY_NTFY_URL)",
  ],
  notifyhuman: ["Décision attendue", "Decision waiting"],
  notifyfailed: ["Échec", "Failure"],
  notifyquota: ["Quota atteint", "Quota reached"],
  notifycompleted: ["Terminé", "Completed"],
  configSection: ["Configuration versionnée", "Versioned configuration"],
  configHint: [
    "Lecture seule : projects/{id}.yaml dans le dépôt infra (PR pour la modifier).",
    "Read-only: projects/{id}.yaml in the infra repo (open a PR to change it).",
  ],
  repo: ["Dépôt", "Repository"],
  branch: ["Branche", "Branch"],
  parallel: ["Agents en parallèle", "Parallel agents"],
  githubProject: ["GitHub Project", "GitHub Project"],
  tracked: ["suivi", "tracked"],
  no: ["non", "no"],
  yes: ["oui", "yes"],
  commands: ["Commandes", "Commands"],
  subscription: ["Abonnement Claude", "Claude subscription"],
  // workflows page
  templates: ["Modèles", "Templates"],
  projectWorkflows: ["Workflows de {p}", "{p} workflows"],
  createFromTemplate: ["Créer depuis un modèle", "Create from a template"],
  publishAsTemplate: ["Publier comme modèle", "Publish as a template"],
  templateUpdate: [
    "Nouvelle version du modèle {t} (v{from} → v{to})",
    "New version of template {t} (v{from} → v{to})",
  ],
  applyTemplateUpdate: [
    "Mettre à jour depuis le modèle",
    "Update from the template",
  ],
  resetTemplate: [
    "Revenir au modèle d'origine",
    "Back to the original template",
  ],
  builtinTemplate: ["modèle intégré", "built-in template"],
  modified: ["modifié", "modified"],
  fromTemplate: ["depuis {t}", "from {t}"],
  statistics: ["Statistiques", "Statistics"],
  // ticket tab
  notATicket: [
    "Cette conversation n'est pas un ticket de la factory.",
    "This conversation is not a factory ticket.",
  ],
  ticketState: ["État : {state}", "State: {state}"],
  updatedAt: ["Mis à jour {at}", "Updated {at}"],
  prNumber: ["PR #{n}", "PR #{n}"],
  workflowVersion: ["{name} · v{version}", "{name} · v{version}"],
  decideInChat: [
    "API de la factory injoignable : décide dans la conversation avec /decide <choix> [commentaire].",
    "Factory API unreachable: decide in the conversation with /decide <outcome> [comment].",
  ],
} as const;

const S = { ...BASE, ...WORKFLOW_STRINGS } as const;

export type FactoryKey = keyof typeof S;

function isFrench(lang: string | undefined): boolean {
  return !!lang && lang.toLowerCase().startsWith("fr");
}

/** Translates a factory key with `{name}` placeholders. */
export function factoryT(
  lang: string | undefined,
  key: FactoryKey,
  vars: Record<string, string | number> = {},
): string {
  const [fr, en] = S[key];
  return (isFrench(lang) ? fr : en).replace(/\{(\w+)\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

/** `t` for factory screens; re-renders when the Canvas language changes. */
export function useFactoryT() {
  const { i18n } = useTranslation();
  const lang = i18n?.language;
  return React.useCallback(
    (key: FactoryKey, vars?: Record<string, string | number>) =>
      factoryT(lang, key, vars),
    [lang],
  );
}

/** Locale for dates and times, aligned with the strings. */
export function useFactoryLocale(): string {
  const { i18n } = useTranslation();
  return isFrench(i18n?.language) ? "fr-FR" : "en-GB";
}
