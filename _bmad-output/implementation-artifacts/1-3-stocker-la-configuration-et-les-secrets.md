# Story 1.3: Stocker la configuration et les secrets

Status: review

## Story

As a Administrateur,
I want sauvegarder les URL, cles API et secrets des services media,
so that Whatsarr puisse les reutiliser apres redemarrage sans les afficher en clair.

## Requirements Traceability

FR1, NFR1, NFR3

## Acceptance Criteria

**Given** l'administrateur renseigne une URL ou une cle API
**When** il sauvegarde la configuration
**Then** la valeur est persistee en SQLite via Prisma
**And** les secrets sont chiffres ou stockes via le mecanisme securise prevu par l'architecture.

**Given** une cle API a ete sauvegardee
**When** l'interface affiche la configuration
**Then** la cle est masquee
**And** l'administrateur peut la remplacer sans voir l'ancienne valeur en clair.

**Given** le conteneur Docker redemarre
**When** l'administrateur revient sur la page Parametres
**Then** la configuration non secrete est toujours disponible
**And** les secrets restent utilisables pour les tests de connexion.

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

- Introduce only the settings/secrets persistence needed by this story.
- Use the application encryption key pattern from architecture before storing service secrets.


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
- Before implementation, read previous story context if present: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\1-2-creer-l-acces-administrateur-local.md`.

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
- 2026-05-20: Verified Plex settings save returns masked secret metadata and no clear API key.

### Completion Notes List

- Story context created from BMAD PRD, architecture, epics, readiness report, and sprint status.
- Added Prisma SQLite models for admin credentials and service settings with snake_case table/column mapping.
- Added AES-256-GCM encryption for service secrets, backed by `APP_ENCRYPTION_KEY` or persistent `/data/encryption.key`.
- API responses expose only camelCase public settings and `hasApiKey` flags; saved secrets are not returned.
- Commands run: `pnpm lint`, `pnpm build`, `pnpm test`; local API save returned masked metadata.

### File List

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/202605200001_initial/migration.sql`
- `apps/api/src/runtime-env.ts`
- `apps/api/src/modules/database/prisma.service.ts`
- `apps/api/src/modules/settings/encryption.service.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `apps/api/src/modules/settings/settings.controller.ts`
- `apps/api/src/modules/settings/settings.dto.ts`
- `apps/api/src/modules/settings/settings.module.ts`
- `apps/api/src/modules/settings/encryption.service.spec.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
