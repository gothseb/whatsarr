# Story 5.1: Configurer les bibliotheques du recap mensuel

Status: review

## Story

As a Administrateur,
I want choisir les bibliotheques Plex incluses dans le recap mensuel,
so that je puisse exclure certaines bibliotheques comme les series animees.

## Requirements Traceability

FR16

## Acceptance Criteria

**Given** Plex est configure
**When** l'administrateur ouvre les parametres du recap mensuel
**Then** Whatsarr affiche les bibliotheques Plex disponibles
**And** chaque bibliotheque peut etre incluse ou exclue.

**Given** l'administrateur modifie la selection
**When** il sauvegarde
**Then** le choix est persiste en base
**And** il reste disponible apres redemarrage Docker.

**Given** aucune bibliotheque n'est selectionnee
**When** le recap mensuel doit etre calcule
**Then** aucun recap n'est envoye
**And** un log indique que le recap est desactive faute de bibliotheque.

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

Epic 5: Suivre l'activite et envoyer le recap mensuel

L'administrateur peut choisir les bibliotheques Plex a inclure, Whatsarr calcule le classement mensuel films + series par utilisateurs distincts, envoie le recap automatiquement et expose les logs/statuts operationnels.

### Story-Specific Guardrails

- Recap disabled state must be explicit when no library is selected.
- This selection controls monthly recap only; do not alter Plex library access globally.


### Architecture Guardrails

- Respect the architecture in `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md`.
- Keep business logic in `apps/api`; `apps/web` must only display, edit and call REST/SSE APIs.
- Use REST JSON under `/api/*`; use camelCase in API/UI and snake_case only in database naming.
- Do not expose Prisma models directly through API responses.
- Never log API keys, tokens, WhatsApp session data, cookies or decrypted secrets.
- Add or update tests for the behavior implemented by this story.

### Likely File/Module Areas

- Epic 5 owns monthly recap, operational logs and live status visibility.
- Likely paths: `apps/api/src/modules/monthly-recap`, `logs`, `jobs`, `tautulli`, `plex`, `sse`, `apps/web/src/features/logs`, dashboard/status UI.
- Monthly recap must use the same outbox/anti-doublon patterns as Epic 4.

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

- `pnpm --filter @whatsarr/api prisma:generate`
- `pnpm --filter @whatsarr/api lint`
- `pnpm --filter @whatsarr/web lint`
- `pnpm --filter @whatsarr/api test`
- `pnpm build`
- `DATABASE_URL=file:../data/whatsarr.db pnpm --filter @whatsarr/api prisma:migrate:deploy`
- Browser check on `http://localhost:5173` with no console errors on the startup screen.

### Completion Notes List

- Story context created from BMAD PRD, architecture, epics, readiness report, and sprint status.
- Implemented Epic 5 monthly recap libraries, Tautulli monthly stats, distinct-user ranking, monthly recap outbox job creation, persistent recap status, operational logs and live dashboard/SSE status.
- Local migration was applied to `apps/api/data/whatsarr.db` with `DATABASE_URL=file:../data/whatsarr.db`.

### File List

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/202605200005_epic5_monthly_recap/migration.sql`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/plex/plex.service.ts`
- `apps/api/src/modules/templates/templates.constants.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/notifications/notifications.types.ts`
- `apps/api/src/modules/monthly-recap/monthly-recap.module.ts`
- `apps/api/src/modules/monthly-recap/monthly-recap.controller.ts`
- `apps/api/src/modules/monthly-recap/monthly-recap.dto.ts`
- `apps/api/src/modules/monthly-recap/monthly-recap.service.ts`
- `apps/api/src/modules/monthly-recap/monthly-recap.service.spec.ts`
- `apps/api/src/modules/monthly-recap/status.controller.ts`
- `apps/api/src/modules/monthly-recap/status.service.ts`
- `apps/web/src/api.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `packages/shared/src/index.ts`
