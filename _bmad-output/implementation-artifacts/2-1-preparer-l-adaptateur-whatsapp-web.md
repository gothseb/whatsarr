# Story 2.1: Preparer l'adaptateur WhatsApp Web

Status: review

## Story

As a Administrateur,
I want que Whatsarr dispose d'un adaptateur WhatsApp Web isole,
so that la connexion WhatsApp puisse evoluer sans impacter le reste de l'application.

## Requirements Traceability

FR3, FR4, FR5, NFR6

## Acceptance Criteria

**Given** le backend Whatsarr est en place
**When** le module WhatsApp est ajoute
**Then** il expose une interface `WhatsAppAdapter`
**And** le driver V1 `whatsapp-web.js` est implemente derriere cette interface.

**Given** un autre module doit envoyer ou lire des donnees WhatsApp
**When** il interagit avec WhatsApp
**Then** il utilise le service WhatsApp ou `WhatsAppAdapter`
**And** il ne depend pas directement de `whatsapp-web.js`.

**Given** l'application tourne en Docker
**When** le conteneur demarre
**Then** Chromium/Puppeteer et les options headless necessaires sont disponibles
**And** les erreurs de demarrage WhatsApp sont journalisees sans secrets.

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

- Treat this as the WhatsApp Docker-risk validation story.
- Include Chromium/Puppeteer runtime needs and surface adapter startup failures cleanly.


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

GPT-5 Codex

### Debug Log References

- `pnpm prisma:generate`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

### Completion Notes List

- Story context created from BMAD PRD, architecture, epics, readiness report, and sprint status.
- Added isolated `WhatsAppAdapter` contract and `whatsapp-web.js` V1 driver behind it.
- Added Chromium/Puppeteer Docker runtime configuration with `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
- Adapter logs startup/auth/disconnect failures with sanitized messages and keeps session data out of logs.

### File List

- `apps/api/package.json`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/whatsapp/adapters/whatsapp-adapter.ts`
- `apps/api/src/modules/whatsapp/adapters/whatsapp-web-js.adapter.ts`
- `apps/api/src/modules/whatsapp/whatsapp.module.ts`
- `apps/api/src/modules/whatsapp/whatsapp.types.ts`
- `apps/api/src/modules/whatsapp/whatsapp.service.ts`
- `apps/api/src/modules/whatsapp/whatsapp.controller.ts`
- `apps/api/src/modules/whatsapp/whatsapp.dto.ts`
- `apps/api/src/modules/whatsapp/whatsapp.service.spec.ts`
- `Dockerfile`
- `pnpm-lock.yaml`
