# Story 1.5: Tester les connexions aux services media

Status: review

## Story

As a Administrateur,
I want tester chaque integration separement,
so that je sache quels services sont prets avant d'activer les automatisations.

## Requirements Traceability

FR2, NFR2, NFR3, NFR5

## Acceptance Criteria

**Given** un service est configure
**When** l'administrateur clique sur "Tester"
**Then** Whatsarr appelle le service concerne
**And** affiche un statut `connecte`, `erreur d'authentification`, `inaccessible` ou `non configure`.

**Given** un test echoue
**When** le statut est affiche
**Then** le message explique l'action probable a corriger
**And** aucun secret n'est affiche dans l'erreur ou les logs.

**Given** plusieurs services sont configures
**When** l'administrateur teste chaque service
**Then** chaque resultat est independant
**And** un echec TMDB ne bloque pas le statut Plex, Tautulli ou Overseerr.

## Tasks / Subtasks

- [x] Review source artifacts and confirm story scope (AC: all)
  - [x] Read this story file fully before editing.
  - [x] Read relevant sections in `epics.md` and `architecture.md` listed below.
- [x] Implement backend behavior required by this story (AC: all)
  - [x] Add or update only the modules needed for this story.
  - [x] Keep business rules in `apps/api`.
- [x] Implement frontend behavior required by this story when UI is in scope (AC: all)
  - [x] Keep UI state/display in `apps/web` and call backend APIs/SSE.
  - [x] Follow the simple Overseerr/Radarr-style admin surface.
- [x] Add or update tests and verification steps (AC: all)
  - [x] Cover happy path and error/degraded paths from acceptance criteria.
  - [x] Verify no secrets are exposed in UI or logs where applicable.
- [x] Update Dev Agent Record before marking complete (AC: all)
  - [x] Fill Completion Notes and File List.
  - [x] Record commands/tests run and any known gaps.

## Dev Notes

### Epic Context

Epic 1: Installer Whatsarr et connecter les services media

L'administrateur peut installer Whatsarr en Docker, creer l'acces admin, configurer les services media, tester les connexions et disposer d'une base persistante fiable.

### Story-Specific Guardrails

- Connection tests should normalize statuses: connected, authentication error, unreachable, not configured.
- Test failures must not block unrelated service statuses.


### Architecture Guardrails

- Respect the architecture in `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md`.
- Keep business logic in `apps/api`; `apps/web` must only display, edit and call REST/SSE APIs.
- Use REST JSON under `/api/*`; use camelCase in API/UI and snake_case only in database naming.
- Do not expose Prisma models directly through API responses.
- Never log API keys, tokens, WhatsApp session data, cookies or decrypted secrets.
- Add or update tests for the behavior implemented by this story.

### Likely File/Module Areas

- Epic 1 owns the application foundation, local admin access and media-service settings.
- Likely paths: root workspace files, `apps/api/src/modules/auth`, `apps/api/src/modules/settings`, `apps/api/src/database`, `apps/web/src/features/settings`, `apps/web/src/pages/SettingsPage.tsx`.
- Do not implement WhatsApp, mapping, notification jobs or recap behavior in Epic 1 stories.

### Dependency Notes

- Implement stories in sprint-status order unless the user explicitly changes priority.
- This story must not depend on a future story in the same epic.
- Before implementation, read previous story context if present: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\1-4-configurer-les-services-media-dans-l-interface.md`.

### Testing Guidance

- Prefer focused unit tests for business rules and service behavior.
- Add integration/e2e coverage when the story crosses API, database, Docker, SSE, or external integration boundaries.
- If an external service cannot be reached in local tests, use a test double and document the manual verification needed.

### References

- PRD: `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\prds\prd-whatsarr-2026-05-19\prd.md`
- Architecture: `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md`
- Epics and Stories: `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\epics.md`
- Sprint status: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\sprint-status.yaml`

## Dev Agent Record

### Agent Model Used

TBD by dev agent.

### Debug Log References

- 2026-05-20: Baseline captured as `NO_VCS`; workspace is not a git repository.
- 2026-05-20: Verified local Plex test normalizes unreachable status without exposing the saved token.

### Completion Notes List

- Story context created from BMAD PRD, architecture, epics, readiness report, and sprint status.
- Added independent connection-test endpoint per service with normalized statuses: `connected`, `authentication_error`, `unreachable`, `not_configured`.
- Added per-service HTTP probes for Plex, Tautulli, Overseerr, Radarr, Sonarr and TMDB.
- Added UI Tester action and result display per service; a failed service test does not block unrelated panels.
- Commands run: `pnpm lint`, `pnpm build`, `pnpm test`; local Plex test returned `unreachable` with no secret exposure.

### File List

- `apps/api/src/modules/settings/connection-test.service.ts`
- `apps/api/src/modules/settings/connection-test.service.spec.ts`
- `apps/api/src/modules/settings/settings.controller.ts`
- `apps/api/src/modules/settings/settings.module.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/styles.css`
