# FG Digital Recording — dual-repository sync

MaintainPro (`jkchinthaka/newmone`) is the umbrella repository. The Finished Goods
Digital Recording System remains a standalone Django project. This directory is a
**Git subtree mirror**, not a rewrite and not a submodule.

## Source of truth

Canonical FG repository:

`https://github.com/jkchinthaka/nelna-fg-digital-recording-system`

Default branch: `main`

## Mirror location

Inside MaintainPro:

`maintainpro/systems/fg-digital-recording/`

Remote name used for subtree operations (MaintainPro clone only):

`fg-origin` → `https://github.com/jkchinthaka/nelna-fg-digital-recording-system.git`

`origin` must remain `https://github.com/jkchinthaka/newmone.git`.

## Architecture boundaries (do not collapse)

| System | Stack | Data |
| --- | --- | --- |
| MaintainPro | Next.js / NestJS / MongoDB / Redis | MaintainPro tenants |
| FG Digital Recording | Django / PostgreSQL / Redis / Celery | FG operational data |

Do **not**: convert Django to NestJS, merge databases, merge auth, or deploy FG
through MaintainPro production pipelines until explicitly planned.

Keep FG under `systems/fg-digital-recording/`. Do **not** move Django apps into
`maintainpro/apps/`.

## Sync workflow (FG → MaintainPro)

1. Develop and test in the standalone FG repository.
2. Commit and push to `nelna-fg-digital-recording-system` (`main` or a PR branch).
3. In a MaintainPro worktree, fetch and pull the subtree:

```bash
git fetch fg-origin
git subtree pull --prefix=maintainpro/systems/fg-digital-recording fg-origin main --squash
```

4. Review the MaintainPro diff, commit if needed, and push `origin`
   (integration/feature branch or main via PR). Never force-push.

## Sync workflow (MaintainPro → FG)

If Cursor or a contributor edits files under
`maintainpro/systems/fg-digital-recording/` inside MaintainPro:

1. Treat those edits as FG product changes.
2. Push them back to the standalone FG repository with subtree push (or an
   equivalent split + PR into FG). Example:

```bash
git subtree push --prefix=maintainpro/systems/fg-digital-recording fg-origin main
```

Prefer opening a PR on the FG repo rather than pushing straight to `main` when
review is required.

3. Do **not** consider FG work complete until the standalone FG repository has
   received the change.
4. Never push the whole MaintainPro/`newmone` repository into the FG repository.

## What must not be committed

- Real `.env` files and secrets
- `node_modules`, Python venvs, `__pycache__`
- Local DB dumps, runtime uploads, `.git` directories

Only tracked FG source belongs in the mirror.

## Build isolation

MaintainPro npm workspaces are limited to `apps/*` and `packages/*`. FG lives
under `systems/` so it is not an npm workspace. Root MaintainPro Docker builds
exclude `maintainpro/systems/` via `.dockerignore`.
