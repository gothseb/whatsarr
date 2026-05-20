# Story 1.2: Creer l'acces administrateur local

Status: review

## Story

As a Administrateur,
I want creer et utiliser un acces admin local,
so that l'interface de configuration ne soit pas ouverte sans protection.

## Requirements Traceability

Additional security requirements, NFR3, NFR4

## Acceptance Criteria

**Given** aucun administrateur n'existe encore
**When** l'utilisateur ouvre l'application
**Then** l'interface propose de creer le mot de passe admin initial
**And** le mot de passe est stocke sous forme hashee.

**Given** un administrateur existe
**When** l'utilisateur se connecte avec le bon mot de passe
**Then** une session HTTP-only est creee
**And** l'utilisateur peut acceder aux pages protegees.

**Given** une tentative de connexion echoue
**When** le mot de passe est incorrect
**Then** l'acces est refuse
**And** le secret ou le hash n'est jamais expose dans les logs.

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

Epic 1: Installer Whatsarr et connecter les services media

L'administrateur peut installer Whatsarr en Docker, creer l'acces admin, configurer les services media, tester les connexions et disposer d'une base persistante fiable.

### Story-Specific Guardrails

- Implement first-run admin password setup and HTTP-only session auth only.
- Do not add roles, OAuth/OIDC or multi-admin behavior in V1.


### Architecture Guardrails

- Respect the architecture in `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md`.
- Keep business logic in `apps/api`; `apps/web` must only display, edit and call REST/SSE APIs.
- Use REST JSON under `/api/*`; use camelCase in API/UI and snake_case only in database naming.
- Do not expose Prisma models directly through API responses.
- Never log API keys, tokens, WhatsApp session data, cookies or decrypted secrets.
- Add or update tests for the behavior implemented by this story.

### Likely File/Module Areas

- Epic 1 owns the application foundation, local admin access and media-service settings.
- Likely paths: root workspace files, `apps/api/src/modules/auth`, `apps/api/src/modules/settings`, `apps/api/src/database`, `apps/web/src/features/settings`, `apps/web/src/pages/SettingsPage.tsx`.
- Do not implement WhatsApp, mapping, notification jobs or recap behavior in Epic 1 stories.

### Dependency Notes

- Implement stories in sprint-status order unless the user explicitly changes priority.
- This story must not depend on a future story in the same epic.
- Before implementation, read previous story context if present: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\1-1-set-up-initial-project-from-starter-template.md`.

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

TBD by dev agent.

### Debug Log References

- 2026-05-20: Baseline captured as `NO_VCS`; workspace is not a git repository.
- 2026-05-20: Verified auth status/setup/login with a PowerShell web session against local API runtime.

### Completion Notes List

- Story context created from BMAD PRD, architecture, epics, readiness report, and sprint status.
- Added first-run admin setup, password hashing with `bcryptjs`, signed HTTP-only session cookie login/logout, and protected settings routes.
- Added setup/login UI flow before the admin settings surface.
- Commands run: `pnpm lint`, `pnpm build`, `pnpm test`; browser verified login and protected settings page.

### File List

- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.guard.ts`
- `apps/api/src/modules/auth/auth.dto.ts`
- `apps/api/src/modules/auth/auth.service.spec.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/202605200001_initial/migration.sql`
- `apps/web/src/App.tsx`
- `apps/web/src/api.ts`
- `apps/web/src/styles.css`
