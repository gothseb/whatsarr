# Story 4.8: Detecter et notifier une demande disponible

Status: review

## Story

As a Administrateur,
I want que Whatsarr previenne l'utilisateur quand sa demande est disponible,
so that je n'aie pas a le faire manuellement.

## Requirements Traceability

FR14, FR20

## Acceptance Criteria

**Given** une demande Overseerr devient disponible
**When** Whatsarr traite l'evenement pour un film ou une saison 1
**Then** il identifie l'Utilisateur Plex demandeur
**And** prepare une notification individuelle.

**Given** Plex signale une saison 2+ ou un nouvel episode lie a une serie demandee ou suivie
**When** Whatsarr resout les utilisateurs concernes
**Then** il utilise Plex comme source de disponibilite
**And** conserve les donnees Overseerr uniquement pour le lien demandeur/suivi.

**Given** l'utilisateur a plusieurs contacts WhatsApp lies
**When** la notification est creee
**Then** un job est cree pour chaque contact lie
**And** tous les jobs partagent une cle anti-doublon adaptee a la cible.

**Given** l'utilisateur n'a aucun contact lie
**When** la demande devient disponible
**Then** aucun message n'est envoye
**And** un log indique que l'utilisateur est non notifiable.

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

- Request availability for films and season 1 comes from Overseerr.
- New seasons and individual episode additions come from Plex; keep Overseerr only as requester/follower context when useful.
- Create one job per linked contact and log non-notifiable users.


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
- Before implementation, read previous story context if present: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\4-7-publier-les-annonces-groupe-de-nouveautes.md`.

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
