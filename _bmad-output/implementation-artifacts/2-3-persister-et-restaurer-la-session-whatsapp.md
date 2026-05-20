# Story 2.3: Persister et restaurer la session WhatsApp

Status: review

## Story

As a Administrateur,
I want que ma session WhatsApp reste active apres redemarrage Docker,
so that je n'aie pas a rescanner un QR code a chaque relance.

## Requirements Traceability

FR4, NFR1, NFR3

## Acceptance Criteria

**Given** une session WhatsApp est connectee
**When** Whatsarr sauvegarde l'etat de session
**Then** les donnees necessaires sont stockees dans `/data`
**And** elles ne sont pas stockees dans le repo.

**Given** le conteneur redemarre avec le volume `/data` conserve
**When** Whatsarr demarre
**Then** il tente de restaurer la session automatiquement
**And** l'interface affiche l'etat reel de restauration.

**Given** WhatsApp invalide la session
**When** Whatsarr ne peut pas restaurer la connexion
**Then** l'interface demande une nouvelle connexion QR
**And** l'erreur est loggee sans exposer les donnees de session.

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

- Session state must live under `/data`, not in repo files.
- If restoration fails, force a clean QR reconnect path.


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
- Before implementation, read previous story context if present: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\2-2-connecter-whatsapp-via-qr-code.md`.

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

- `pnpm lint`
- `pnpm test`
- `pnpm build`

### Completion Notes List

- Story context created from BMAD PRD, architecture, epics, readiness report, and sprint status.
- `LocalAuth` persists WhatsApp session data under `${DATA_DIR}/whatsapp`, which resolves to `/data/whatsapp` in Docker.
- Backend attempts automatic restore on module startup when local session files exist.
- UI exposes the restoration/failed state through the same status and SSE channel.

### File List

- `apps/api/src/modules/whatsapp/adapters/whatsapp-web-js.adapter.ts`
- `apps/api/src/modules/whatsapp/whatsapp.service.ts`
- `apps/api/src/modules/whatsapp/whatsapp.types.ts`
- `apps/web/src/App.tsx`
- `Dockerfile`
