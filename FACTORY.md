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
