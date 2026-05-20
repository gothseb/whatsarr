# Story 2.2: Connecter WhatsApp via QR code

Status: review

## Story

As a Administrateur,
I want scanner un QR code WhatsApp depuis l'interface,
so that Whatsarr puisse utiliser mon compte WhatsApp comme session Web.

## Requirements Traceability

FR3, UX-DR3, UX-DR7

## Acceptance Criteria

**Given** aucune session WhatsApp n'est connectee
**When** l'administrateur ouvre la page WhatsApp
**Then** il peut demarrer une connexion
**And** un QR code est affiche via l'UI.

**Given** le QR code est affiche
**When** l'administrateur le scanne avec WhatsApp
**Then** la session passe a l'etat `connectee`
**And** l'etat est mis a jour dans l'interface via SSE.

**Given** la connexion echoue ou expire
**When** l'etat WhatsApp change
**Then** l'interface affiche un etat exploitable
**And** l'administrateur peut relancer une tentative de connexion.

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

- QR and session state should update via SSE; avoid fast polling.
- Do not persist session secrets in logs or UI state.


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
- Before implementation, read previous story context if present: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\2-1-preparer-l-adaptateur-whatsapp-web.md`.

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
- Added `POST /api/whatsapp/connect`, `GET /api/whatsapp/status`, and SSE `/api/whatsapp/events`.
- QR codes are converted to data URLs server-side and streamed to the UI.
- UI page displays connection states, QR code, failures, and retry/replace actions.

### File List

- `apps/api/src/modules/whatsapp/whatsapp.controller.ts`
- `apps/api/src/modules/whatsapp/whatsapp.service.ts`
- `apps/api/src/modules/whatsapp/whatsapp.dto.ts`
- `apps/api/src/modules/whatsapp/adapters/whatsapp-web-js.adapter.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/styles.css`
- `packages/shared/src/index.ts`
