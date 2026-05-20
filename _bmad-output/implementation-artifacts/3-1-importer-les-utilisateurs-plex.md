# Story 3.1: Importer les utilisateurs Plex

Status: review

## Story

As a Administrateur,
I want importer les utilisateurs Plex accessibles au serveur,
so that je puisse les associer aux contacts WhatsApp.

## Requirements Traceability

FR8, UX-DR4, NFR5

## Acceptance Criteria

**Given** Plex est configure et joignable
**When** l'administrateur ouvre la page Mapping
**Then** Whatsarr peut recuperer les utilisateurs Plex
**And** affiche leur nom, identifiant Plex et etat de mapping.

**Given** Plex n'est pas configure ou inaccessible
**When** l'import est demande
**Then** l'interface affiche une erreur exploitable
**And** aucun mapping existant n'est supprime.

**Given** des utilisateurs Plex ont deja ete importes
**When** l'administrateur relance une synchronisation
**Then** les utilisateurs nouveaux ou modifies sont mis a jour
**And** les associations existantes sont conservees quand l'identifiant Plex existe toujours.

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

Epic 3: Lier utilisateurs Plex et contacts WhatsApp

L'administrateur peut importer les utilisateurs Plex et les membres du groupe WhatsApp, puis associer un utilisateur Plex a un ou plusieurs contacts WhatsApp pour rendre les notifications individuelles possibles.

### Story-Specific Guardrails

- Plex user identity must be stable; do not key mappings on display names alone.
- Refresh must not delete mappings for unchanged Plex identifiers.


### Architecture Guardrails

- Respect the architecture in `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md`.
- Keep business logic in `apps/api`; `apps/web` must only display, edit and call REST/SSE APIs.
- Use REST JSON under `/api/*`; use camelCase in API/UI and snake_case only in database naming.
- Do not expose Prisma models directly through API responses.
- Never log API keys, tokens, WhatsApp session data, cookies or decrypted secrets.
- Add or update tests for the behavior implemented by this story.

### Likely File/Module Areas

- Epic 3 owns Plex user/contact mapping and notifiable-user state.
- Likely paths: `apps/api/src/modules/mapping`, `apps/api/src/modules/plex`, `apps/api/src/modules/whatsapp`, `apps/web/src/features/mapping`, `apps/web/src/pages/MappingPage.tsx`.
- Preserve existing WhatsApp member imports and Plex user identities when refreshing data.

### Dependency Notes

- Implement stories in sprint-status order unless the user explicitly changes priority.
- This story must not depend on a future story in the same epic.
- No previous story file required for this story.

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

GPT-5

### Debug Log References

### Completion Notes List

- Story context created from BMAD PRD, architecture, epics, readiness report, and sprint status.
- Added Plex user import through the existing encrypted Plex service settings, preserving existing mappings on refresh.
- Verification: `pnpm prisma:generate`; `pnpm --filter @whatsarr/shared build`; `pnpm --filter @whatsarr/api test`; `pnpm --filter @whatsarr/api lint`; `pnpm --filter @whatsarr/api build`; `pnpm --filter @whatsarr/web lint`; `pnpm --filter @whatsarr/web build`.
- Browser check reached the local app, but visual Mapping verification was blocked by the admin setup screen; no admin password was created.

### File List

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/202605200003_mapping_epic/migration.sql`
- `apps/api/src/modules/database/prisma.service.ts`
- `apps/api/src/modules/plex/plex.module.ts`
- `apps/api/src/modules/plex/plex.service.ts`
- `apps/api/src/modules/mapping/mapping.controller.ts`
- `apps/api/src/modules/mapping/mapping.dto.ts`
- `apps/api/src/modules/mapping/mapping.module.ts`
- `apps/api/src/modules/mapping/mapping.service.ts`
- `apps/api/src/modules/mapping/mapping.service.spec.ts`
- `apps/api/src/app.module.ts`
- `packages/shared/src/index.ts`
- `packages/shared/dist/index.d.ts`
- `packages/shared/dist/index.js`
- `apps/web/src/api.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/MappingPage.tsx`
- `apps/web/src/styles.css`
