# Software-factory fork of OpenHands Agent Canvas

Fork of [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) (MIT) used as the UI of
the [software factory](https://github.com/Asteb612/software-factory). Only the Canvas frontend
and its image are forked: the Agent Server, Claude Code and the ACP adapter stay official and
unmodified.

## Branches and tags
- `factory` (default): our customizations, on top of an upstream release tag.
- Upstream tags (`v1.43.0`, ...) are kept as reference points.

Current base: **v1.43.0**.

## Rules for customizations
- Our code lives under `src/factory/` (components, hooks, styles). Upstream files only get the
  few lines needed to hook it in, each marked with a `// factory:` comment. That keeps
  rebases short.
- Upstream CI workflows and Dependabot are removed on this branch (they need upstream secrets
  and publish upstream artifacts). `.github/workflows/factory.yml` runs lint, unit tests,
  build, then builds the image and smoke-tests it.
- No product telemetry: the image is built with an empty `VITE_POSTHOG_API_KEY`.

## Factory features
The fork is the **command center** of the software factory: one Canvas for every project.
- **Project = backend** (`src/factory/project-context.tsx`): each project's Agent Server is a
  Canvas backend `factory-<project>` (host `<origin>/agents/<project>`, no key: the ingress
  adds it). The sidebar project picker switches the backend (conversations, workspaces,
  agent settings follow); links to a ticket's conversation carry `?backend=`.
- **Tickets** (`/factory/tickets`): the active project's runs (its own columns) or every
  project's; decide (shared `DecisionPanel`), retry, new ticket, start on an issue; status
  bar (global pause, quota per Claude subscription).
- **Workflows** (`/factory/workflows`, `src/factory/workflows/`): node editor on the active
  project's own workflows or on the template library (create from a template, publish as a
  template, template updates), statistics, runs.
- **Project** (`/factory/project`): pause, enabled/default workflows, board columns,
  notifications, versioned config (read-only).
- **Conversation**: banner and Ticket tab (same decision panel), card badges (active project).
- **Task type** on the home composer: plain chat or a workflow of the active project.
- **Notifications**: browser notifications while a tab is open (`notifier.tsx`).
- Building blocks: `src/factory/api/` (client + hooks per domain, quiet queries,
  `reportFactoryError`), `src/factory/ui/` (kit over the Canvas components),
  `src/factory/i18n.ts` (French/English, follows the Canvas language), `states.ts`.

## Image
`ghcr.io/asteb612/factory-canvas:<canvas version>-<sha7>`, built from `docker/Dockerfile`
with the pins of `config/defaults.json`. The factory agent image
(`software-factory/agent-image`) is built `FROM` it.

## Catching up with upstream (when needed)
```sh
git remote add upstream https://github.com/OpenHands/OpenHands.git   # once
git fetch upstream --tags
git rebase --onto vX.Y.Z v1.43.0 factory   # replace v1.43.0 with the current base
# conflicts: keep upstream, re-apply the // factory: hooks; deleted workflows stay deleted
npm ci && npm run lint && npm test && npm run build
git push --force-with-lease origin factory
```
Then update "Current base" above, and bump the image tag in software-factory / infra-terraform.
