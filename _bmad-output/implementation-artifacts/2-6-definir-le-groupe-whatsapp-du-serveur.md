# Story 2.6: Definir le groupe WhatsApp du serveur

Status: review

## Story

As a Administrateur,
I want selectionner le groupe WhatsApp du serveur Plex,
so that les annonces collectives soient publiees au bon endroit.

## Requirements Traceability

FR6, NFR2

## Acceptance Criteria

**Given** la liste des groupes WhatsApp est affichee
**When** l'administrateur selectionne un groupe
**Then** ce groupe est sauvegarde comme Groupe serveur
**And** le choix persiste apres redemarrage Docker.

**Given** un Groupe serveur est deja selectionne
**When** l'administrateur choisit un autre groupe
**Then** une confirmation est demandee
**And** le changement est journalise.

**Given** aucun Groupe serveur n'est selectionne
**When** une fonctionnalite d'annonce groupe est appelee plus tard
**Then** elle doit echouer proprement avec une erreur `WHATSAPP_GROUP_NOT_SELECTED`.

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

Epic 2: Connecter WhatsApp et definir le groupe serveur

L'administrateur peut connecter son compte WhatsApp via QR code, conserver la session apres redemarrage, lister ses groupes et choisir le groupe WhatsApp du serveur.

### Story-Specific Guardrails

- The selected group is required by later group-send stories.
- Missing group should produce stable error code `WHATSAPP_GROUP_NOT_SELECTED`.


### Architecture Guardrails

- Respect the architecture in `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md`.
- Keep business logic in `apps/api`; `apps/web` must only display, edit and call REST/SSE APIs.
- Use REST JSON under `/api/*`; use camelCase in API/UI and snake_case only in database naming.
- Do not expose Prisma models directly through API responses.
- Never log API keys, tokens, WhatsApp session data, cookies or decrypted secrets.
- Add or update tests for the behavior implemented by this story.

### Likely File/Module Areas

- Epic 2 owns WhatsApp Web session management and group/member discovery.
- Likely paths: `apps/api/src/modules/whatsapp`, `apps/api/src/modules/whatsapp/adapters`, `apps/api/src/sse`, `apps/web/src/features/whatsapp`, `apps/web/src/pages/WhatsAppPage.tsx`.
- Keep `whatsapp-web.js` behind `WhatsAppAdapter`; no other module should import it directly.

### Dependency Notes

- Implement stories in sprint-status order unless the user explicitly changes priority.
- This story must not depend on a future story in the same epic.
- Before implementation, read previous story context if present: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\2-5-lister-les-groupes-whatsapp.md`.

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

GPT-5 Codex

### Debug Log References

- `pnpm prisma:generate`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

### Completion Notes List

- Story context created from BMAD PRD, architecture, epics, readiness report, and sprint status.
- Added persistent `WhatsAppServerGroup` storage and migration.
- Selecting a new server group requires confirmation when one is already selected and logs the change.
- Added `requireServerGroup()` behavior that fails with `WHATSAPP_GROUP_NOT_SELECTED` for later announcement flows.
- Added unit coverage for replacement confirmation.

### File List

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/202605200002_whatsapp_epic/migration.sql`
- `apps/api/src/modules/database/prisma.service.ts`
- `apps/api/src/modules/whatsapp/whatsapp.service.ts`
- `apps/api/src/modules/whatsapp/whatsapp.service.spec.ts`
- `apps/api/src/modules/whatsapp/whatsapp.controller.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `packages/shared/src/index.ts`
