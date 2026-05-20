# Story 3.5: Supprimer ou modifier un mapping

Status: review

## Story

As a Administrateur,
I want supprimer ou modifier une association Plex/WhatsApp,
so that je puisse corriger les erreurs de mapping.

## Requirements Traceability

FR8, NFR1

## Acceptance Criteria

**Given** un mapping existe
**When** l'administrateur le supprime
**Then** l'association est retiree
**And** l'utilisateur Plex ou le contact WhatsApp ne sont pas supprimes.

**Given** un utilisateur Plex avait un seul contact lie
**When** ce mapping est supprime
**Then** l'utilisateur repasse a l'etat `non notifiable`.

**Given** l'administrateur ajoute un nouveau contact apres suppression
**When** il sauvegarde
**Then** le nouvel etat de mapping est visible immediatement.

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

- Deleting a mapping must not delete the underlying Plex user or WhatsApp contact.
- Ensure the UI updates notifiable/non-notifiable state immediately after changes.


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
- Before implementation, read previous story context if present: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\3-4-associer-plusieurs-contacts-whatsapp-a-un-utilisateur-plex.md`.

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
- Added mapping deletion by id without deleting the Plex user or WhatsApp contact records.
- The Mapping UI refreshes state after add/delete so non-notifiable status updates immediately.
- Verification: `pnpm prisma:generate`; `pnpm --filter @whatsarr/shared build`; `pnpm --filter @whatsarr/api test`; `pnpm --filter @whatsarr/api lint`; `pnpm --filter @whatsarr/api build`; `pnpm --filter @whatsarr/web lint`; `pnpm --filter @whatsarr/web build`.
- Browser check reached the local app, but visual Mapping verification was blocked by the admin setup screen; no admin password was created.

### File List

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/202605200003_mapping_epic/migration.sql`
- `apps/api/src/modules/database/prisma.service.ts`
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
