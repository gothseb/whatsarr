# Story 1.1: Set up initial project from starter template

Status: review

## Story

As a Administrateur,
I want installer Whatsarr via Docker avec stockage persistant,
so that l'application puisse etre lancee et conserver ses donnees apres redemarrage.

## Acceptance Criteria

1. Given un repo vide ou fraichement initialise, when le projet est scaffolde, then il contient un monorepo Turborepo avec `apps/api`, `apps/web` et `packages/shared`, and il utilise TypeScript, NestJS cote API et Vite React cote UI.
2. Given l'administrateur lance Docker Compose, when le service `whatsarr` demarre, then l'API repond a un healthcheck, and un volume `/data` est monte pour les donnees persistantes.
3. Given le conteneur est redemarre, when l'application redemarre, then les fichiers persistants dans `/data` sont conserves.

## Tasks / Subtasks

- [x] Initialize the TypeScript monorepo in the current workspace (AC: 1)
  - [x] Create root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`.
  - [x] Create `apps/api`, `apps/web`, and `packages/shared`.
  - [x] Do not create a nested `whatsarr/` folder; the current workspace is already the project root.
- [x] Scaffold the NestJS API app (AC: 1, 2)
  - [x] Add a minimal NestJS app under `apps/api`.
  - [x] Add `GET /api/health` returning a JSON health payload.
  - [x] Configure API scripts for `dev`, `build`, `start`, `test`, and `lint`.
- [x] Scaffold the Vite React web app (AC: 1)
  - [x] Add a minimal Vite React TypeScript app under `apps/web`.
  - [x] Add a basic shell page that can call/display API health.
  - [x] Configure web scripts for `dev`, `build`, `preview`, `test`, and `lint` where supported.
- [x] Create shared package baseline (AC: 1)
  - [x] Add `packages/shared/src/index.ts`.
  - [x] Add directories for `schemas`, `types`, `constants`, and `events`.
  - [x] Export a minimal shared constant or type to validate package wiring.
- [x] Add Docker runtime with persistent `/data` (AC: 2, 3)
  - [x] Create root `Dockerfile` using a multi-stage Node build.
  - [x] Create root `docker-compose.yml` with service `whatsarr`, exposed app port, healthcheck, and a named or bind volume mounted at `/data`.
  - [x] Ensure the container creates or can write to `/data`.
- [ ] Add validation checks (AC: 1, 2, 3)
  - [x] `pnpm install` succeeds.
  - [x] `pnpm build` succeeds across workspaces.
  - [ ] `docker compose up --build` starts the service.
  - [ ] API healthcheck succeeds from host and Docker healthcheck.
  - [ ] A restart does not remove data written under `/data`.

## Dev Notes

### Scope Boundaries

- This story is only the application foundation. Do not implement admin auth, settings persistence, Prisma, WhatsApp, Plex, TMDB, jobs, mapping, templates, or logs here.
- It is acceptable to add placeholder layout/UI only to prove the frontend builds and can reach the backend health endpoint.
- Do not move, delete, or rewrite BMAD artifacts under `_bmad`, `.agents`, `_bmad-output/planning-artifacts`, or existing implementation artifacts.

### Architecture Compliance

- Stack: TypeScript everywhere, Turborepo monorepo, NestJS API, Vite React UI, `packages/shared` for contracts. [Source: `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md` - Starter Template Evaluation]
- Root structure must align with the architecture document: `apps/api`, `apps/web`, `packages/shared`, root Docker files, root workspace config. [Source: `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md` - Project Structure & Boundaries]
- API communication pattern is REST JSON under `/api/*`; health endpoint should follow that prefix. [Source: `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md` - API & Communication Patterns]
- Docker deployment target is a single app service with persistent `/data`. [Source: `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md` - Infrastructure & Deployment]

### File Structure Requirements

Create or update these root-level files:

- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `.env.example`
- `.gitignore`
- `Dockerfile`
- `docker-compose.yml`
- optional but useful: `.dockerignore`, `README.md`

Create these application/package paths:

- `apps/api/package.json`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/health/health.controller.ts`
- `apps/web/package.json`
- `apps/web/index.html`
- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `packages/shared/package.json`
- `packages/shared/src/index.ts`

### Docker Requirements

- Use Node.js 24 LTS as the preferred runtime line for this greenfield project.
- Use multi-stage Docker builds and avoid `node:latest`.
- The runtime container must expose a single application port and include a Docker healthcheck hitting the API health endpoint.
- Mount `/data` in `docker-compose.yml`; this story only proves persistence, later stories decide what data lives there.

### Current Workspace Notes

- The current workspace is not a git repository at story creation time. Do not rely on git history.
- No previous story file exists; this is the first implementation story.
- Because the workspace already contains BMAD outputs, generator commands that insist on an empty target directory should be run in a temporary folder and merged carefully into the current root, or replaced with equivalent manual scaffolding.

### Latest Technical Information

- Turborepo official docs still use `pnpm dlx create-turbo@latest` for new monorepos.
- NestJS official CLI docs support strict TypeScript project creation with `nest new --strict`.
- shadcn/ui docs support Vite monorepo initialization with `pnpm dlx shadcn@latest init -t vite --monorepo`; this story may prepare the UI for shadcn, but detailed component work can wait for UI stories.
- Node.js 24 is the active LTS line and is appropriate for a new Node service.
- Docker docs recommend multi-stage builds for smaller, cleaner final images.

### Testing Requirements

- At minimum, add an API health endpoint test or a simple e2e smoke test if the Nest scaffold supports it.
- Validate Docker manually as part of the story:
  - `docker compose up --build`
  - health endpoint returns success
  - write a sentinel file to `/data`, restart the service, confirm it remains
- If a check cannot be automated yet, document the exact manual verification result in the Dev Agent Record.

### References

- PRD: `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\prds\prd-whatsarr-2026-05-19\prd.md`
- Architecture: `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\architecture.md`
- Epics and Stories: `N:\windsurf\whatsarr\_bmad-output\planning-artifacts\epics.md`
- Sprint status: `N:\windsurf\whatsarr\_bmad-output\implementation-artifacts\sprint-status.yaml`
- Turborepo create command: https://turborepo.com/docs/reference/create-turbo
- NestJS CLI strict project guidance: https://docs.nestjs.com/cli/tasks
- shadcn/ui Vite monorepo install: https://ui.shadcn.com/docs/installation/vite
- Node.js release schedule: https://github.com/nodejs/Release
- Docker build best practices: https://docs.docker.com/build/building/best-practices/

## Dev Agent Record

### Agent Model Used

TBD by dev agent.

### Debug Log References

- 2026-05-20: Baseline captured as `NO_VCS`; workspace is not a git repository.

### Completion Notes List

- Story context created from BMAD PRD, architecture, epics, readiness report, and sprint status.
- No previous story intelligence available.
- No git history available at story creation time.
- Created the Turborepo workspace, NestJS API, Vite React UI, shared package, Dockerfile and Docker Compose service.
- Added `/api/health`; host healthcheck returned `status: ok` from the local API runtime.
- Docker validation remains open because `docker` / `docker compose` are not installed in this environment.
- Commands run: `pnpm install`, `pnpm prisma:generate`, `pnpm lint`, `pnpm build`, `pnpm test`.

### File List

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `.gitignore`
- `.env.example`
- `.dockerignore`
- `Dockerfile`
- `docker-compose.yml`
- `README.md`
- `apps/api/**`
- `apps/web/**`
- `packages/shared/**`
