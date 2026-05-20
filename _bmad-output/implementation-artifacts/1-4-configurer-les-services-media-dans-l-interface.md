# Story 1.4: Configurer les services media dans l'interface

Status: review

## Story

As a Administrateur,
I want configurer Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB depuis une page Parametres,
so that Whatsarr connaisse les services a connecter.

## Requirements Traceability

FR1, UX-DR1, UX-DR2, NFR4

## Acceptance Criteria

**Given** l'administrateur ouvre la page Parametres
**When** les sections services sont affichees
**Then** il voit les champs necessaires pour Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB
**And** chaque service peut etre configure independamment.

**Given** un champ requis est invalide ou vide
**When** l'administrateur tente de sauvegarder
**Then** l'interface affiche une erreur claire
**And** aucune valeur invalide n'ecrase la configuration existante.

**Given** la configuration est sauvegardee
**When** l'API renvoie les parametres
**Then** les champs exposes a l'UI sont en camelCase
**And** les modeles Prisma ne sont pas exposes bruts.

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

- UI should be simple and admin-focused, following Overseerr/Radarr-style settings pages.
- Mask saved secrets; allow replacement without revealing existing values.


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
- Before implementation, read previous story context if present: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\1-3-stocker-la-configuration-et-les-secrets.md`.

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
- 2026-05-20: Browser verified protected Parametres page rendering Plex, Tautulli, Overseerr, Radarr, Sonarr and TMDB.

### Completion Notes List

- Story context created from BMAD PRD, architecture, epics, readiness report, and sprint status.
- Added a protected settings page with independent panels for Plex, Tautulli, Overseerr, Radarr, Sonarr and TMDB.
- Added field validation in the UI and API; invalid required values cannot overwrite saved settings.
- API settings responses are camelCase and do not expose Prisma records directly.
- Commands run: `pnpm lint`, `pnpm build`, `pnpm test`; browser verified settings UI.

### File List

- `apps/api/src/modules/settings/settings.constants.ts`
- `apps/api/src/modules/settings/settings.dto.ts`
- `apps/api/src/modules/settings/settings.controller.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/styles.css`
- `apps/web/vite.config.ts`
