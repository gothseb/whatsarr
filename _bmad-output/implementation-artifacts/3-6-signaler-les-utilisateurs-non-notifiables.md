# Story 3.6: Signaler les utilisateurs non notifiables

Status: review

## Story

As a Administrateur,
I want voir quels utilisateurs Plex ne peuvent pas recevoir de message individuel,
so that je puisse completer les mappings manquants.

## Requirements Traceability

FR8, FR14, NFR2

## Acceptance Criteria

**Given** certains utilisateurs Plex n'ont aucun contact WhatsApp lie
**When** la page Mapping est affichee
**Then** ils sont clairement marques comme `non notifiables`.

**Given** un evenement de notification cible un utilisateur non notifiable plus tard
**When** le systeme resout les destinataires
**Then** aucun message n'est envoye
**And** un log operationnel indique que l'utilisateur n'a pas de contact lie.

**Given** tous les utilisateurs Plex ont au moins un contact lie
**When** la page Mapping est affichee
**Then** aucun avertissement global de mapping incomplet n'est affiche.

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

- This story provides guardrails for later notification stories.
- Non-notifiable resolution must create operational logs, not silent skips.


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
- Before implementation, read previous story context if present: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\3-5-supprimer-ou-modifier-un-mapping.md`.

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
- Added non-notifiable status and a global warning only when at least one imported Plex user has no linked contact.
- Recipient resolution logs non-notifiable users and returns no recipients when no linked contact exists.
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
