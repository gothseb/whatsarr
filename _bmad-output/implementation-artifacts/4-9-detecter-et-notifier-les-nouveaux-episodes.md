# Story 4.9: Detecter et notifier les nouveaux episodes

Status: review

## Story

As a Administrateur,
I want que Whatsarr previenne les spectateurs et demandeurs quand un nouvel episode arrive,
so that les personnes interessees soient informees directement.

## Requirements Traceability

FR15, FR20

## Acceptance Criteria

**Given** un nouvel episode est disponible sur Plex
**When** l'evenement est traite
**Then** Whatsarr identifie la serie, la saison et l'episode
**And** prepare une notification `nouvel episode` avec Plex comme source de verite.

**Given** le premier ou les premiers episodes d'une saison 2+ arrivent sur Plex
**When** l'evenement est traite
**Then** Whatsarr peut aussi produire une disponibilite de nouvelle saison dedupliquee au niveau serie/saison.

**Given** des utilisateurs ont regarde la serie ou l'ont demandee/suivie
**When** les destinataires sont resolus
**Then** les utilisateurs sont dedupliques
**And** tous les contacts WhatsApp lies a chaque utilisateur sont cibles.

**Given** un meme utilisateur apparait via historique et demande
**When** les jobs sont crees
**Then** l'utilisateur ne recoit pas deux fois le meme message sur le meme contact.

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
- [x] Add or update tests and verification steps (AC: all)`r`n  - [x] Cover happy path and error/degraded paths from acceptance criteria.`r`n  - [x] Verify no secrets are exposed in UI or logs where applicable.
- [x] Update Dev Agent Record before marking complete (AC: all)`r`n  - [x] Fill Completion Notes and File List.`r`n  - [x] Record commands/tests run and any known gaps.

## Dev Notes

### Epic Context

Epic 4: Automatiser les messages WhatsApp utiles

L'administrateur peut personnaliser les templates et Whatsarr peut envoyer automatiquement les annonces de nouveautes recentes, les notifications de demandes disponibles et les alertes de nouveaux episodes, avec routage de source de verite, enrichissement TMDB, outbox, retry et anti-doublon.

### Story-Specific Guardrails

- Deduplicate users across watch history and requests/follows before resolving contacts.
- A contact should not receive duplicate messages for the same episode event.
- Plex is always the source of truth for new episodes in an ongoing season and for seasons 2+.
- Overseerr may contribute requester/follower context, but must not block episode-level notification.


### Architecture Guardrails

- Respect the architecture in `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md`.
- Keep business logic in `apps/api`; `apps/web` must only display, edit and call REST/SSE APIs.
- Use REST JSON under `/api/*`; use camelCase in API/UI and snake_case only in database naming.
- Do not expose Prisma models directly through API responses.
- Never log API keys, tokens, WhatsApp session data, cookies or decrypted secrets.
- Add or update tests for the behavior implemented by this story.

### Likely File/Module Areas

- Epic 4 owns templates, events, notification jobs, automated sends, TMDB enrichment and anti-doublon.
- Likely paths: `apps/api/src/modules/templates`, `events`, `notifications`, `jobs`, `plex`, `tmdb`, `overseerr`, `tautulli`, `apps/web/src/features/templates`, `apps/web/src/features/logs`.
- All WhatsApp sends must go through `notification_jobs`; never send directly from a controller or integration module.

### Dependency Notes

- Implement stories in sprint-status order unless the user explicitly changes priority.
- This story must not depend on a future story in the same epic.
- Before implementation, read previous story context if present: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\4-8-detecter-et-notifier-une-demande-disponible.md`.

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

- pnpm --filter @whatsarr/api prisma:generate
- pnpm --filter @whatsarr/shared build
- pnpm --filter @whatsarr/api lint
- pnpm --filter @whatsarr/web lint
- pnpm --filter @whatsarr/api test
- pnpm build
- DATABASE_URL=file:N:/windsurf/whatsarr/apps/api/data/whatsarr.db pnpm run prisma:migrate:deploy
- Browser check: http://localhost:5173 loaded to the expected admin access screen.

### Completion Notes List

- Story context created from BMAD PRD, architecture, epics, readiness report, and sprint status.
- Implemented Epic 4 API foundation: configurable templates with explicit variables, persistent notification outbox, dedupe, worker retry, operational logs, media routing, TMDB enrichment fallback, recent-release filtering, announcement jobs and individual contact notifications.
- Implemented admin UI for Templates, recent window, TMDB attribution, notification jobs, logs, manual processing and failed-job retry.
- Applied local SQLite migration and reconciled Prisma migration history for the existing local database.

### File List

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/202605200004_epic4_notifications/migration.sql
- apps/api/src/app.module.ts
- apps/api/src/modules/templates/templates.constants.ts
- apps/api/src/modules/templates/templates.dto.ts
- apps/api/src/modules/templates/templates.service.ts
- apps/api/src/modules/templates/templates.controller.ts
- apps/api/src/modules/templates/templates.module.ts
- apps/api/src/modules/templates/templates.service.spec.ts
- apps/api/src/modules/notifications/notifications.types.ts
- apps/api/src/modules/notifications/notifications.service.ts
- apps/api/src/modules/notifications/notifications.controller.ts
- apps/api/src/modules/notifications/notifications.module.ts
- apps/api/src/modules/notifications/notifications.service.spec.ts
- apps/api/src/modules/media/media.dto.ts
- apps/api/src/modules/media/media.service.ts
- apps/api/src/modules/media/media.controller.ts
- apps/api/src/modules/media/media.module.ts
- apps/api/src/modules/media/media.service.spec.ts
- apps/api/src/modules/whatsapp/whatsapp.types.ts
- apps/api/src/modules/whatsapp/adapters/whatsapp-web-js.adapter.ts
- apps/api/src/modules/whatsapp/whatsapp.service.spec.ts
- apps/web/src/App.tsx
- apps/web/src/api.ts
- apps/web/src/styles.css
- packages/shared/src/index.ts
