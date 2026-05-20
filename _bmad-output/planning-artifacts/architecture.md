---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - "_bmad-output/planning-artifacts/briefs/brief-whatsarr-2026-05-19/brief.md"
  - "_bmad-output/planning-artifacts/prds/prd-whatsarr-2026-05-19/prd.md"
workflowType: "architecture"
lastStep: 8
status: "complete"
completedAt: "2026-05-19"
revisedAt: "2026-05-20"
project_name: "whatsarr"
user_name: "Seb"
date: "2026-05-19"
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## 1. Initialization

Architecture workflow initialized from the current product inputs.

### Input Documents Loaded

- Product Brief: `_bmad-output/planning-artifacts/briefs/brief-whatsarr-2026-05-19/brief.md`
- PRD: `_bmad-output/planning-artifacts/prds/prd-whatsarr-2026-05-19/prd.md`

### Documents Not Found

- UX design: none found
- Research documents: none found
- Project documentation: none found
- Project context: none found

### Initial Architecture Focus

- Docker self-hosted deployment
- Simple Overseerr/Radarr-style web UI
- Single administrator
- Single Plex server
- Single WhatsApp Web session
- Persistent local state
- Media-service integrations
- Event detection and anti-duplicate notification pipeline
- Isolated WhatsApp Web adapter

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
Whatsarr couvre 20 exigences fonctionnelles organisees en 8 blocs architecturaux: configuration des services media, session WhatsApp Web, groupe serveur et mapping utilisateurs, templates de messages, annonces de nouveautes recentes, notifications individuelles, recap mensuel, journalisation et anti-doublons.

Architecturalement, cela implique une application full-stack avec:

- une UI d'administration simple;
- une API backend pour configuration, statuts et mappings;
- des clients d'integration pour Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB;
- un adaptateur WhatsApp Web isole;
- un moteur d'evenements et de regles;
- une file d'envoi ou mecanisme de retry;
- un stockage persistant pour configuration, session WhatsApp, mappings, logs et historique anti-doublon.

**Non-Functional Requirements:**
Les NFR structurants sont la fiabilite apres redemarrage Docker, la confidentialite des secrets, l'observabilite des evenements et erreurs, la simplicite UI dans l'esprit Overseerr/Radarr, et la degradation controlee quand une integration secondaire est indisponible.

**Scale & Complexity:**

- Primary domain: full-stack self-hosted automation app
- Complexity level: medium-high
- Estimated architectural components: 9

Les composants attendus sont:

1. Web UI
2. Backend API
3. Persistent storage
4. Settings/secrets service
5. Media integrations layer
6. WhatsApp Web adapter
7. Event detection pipeline
8. Notification/rules engine
9. Logging and operational status module

### Technical Constraints & Dependencies

- Deploiement Docker avec volume persistant obligatoire.
- Usage personnel, mono-admin, mono-serveur Plex principal, mono-session WhatsApp.
- Pas d'API Meta WhatsApp Business.
- WhatsApp doit etre pilote comme WhatsApp Web dans un environnement serveur.
- Le routage de source de verite est explicite: Overseerr pour films et premiere saison de serie; Plex pour saisons 2+ et nouveaux episodes individuels.
- Tautulli/Plex history sont candidats pour l'historique de visionnage et le recap mensuel.
- Overseerr reste necessaire pour relier les demandes aux utilisateurs, surtout films et saison 1.
- TMDB est necessaire pour enrichissement, date de sortie, titre francais, affiche, synopsis et note.
- Les annonces groupe sont limitees aux sorties recentes avec seuil configurable, 6 mois par defaut.
- Les notifications individuelles doivent envoyer a tous les contacts WhatsApp lies a l'utilisateur Plex.

### Cross-Cutting Concerns Identified

- Persistance: configuration, session WhatsApp, mappings, logs, etat anti-doublon.
- Robustesse WhatsApp: reconnexion, QR code, etat de session, isolation de la librairie.
- Anti-doublon: annonces, demandes disponibles, episodes, recap mensuel.
- Securite locale: masquage des secrets et limitation des logs sensibles.
- Observabilite: comprendre pourquoi un message a ete envoye, ignore, echoue ou deduplique.
- Degradation: continuer a fonctionner partiellement si TMDB, Overseerr, Tautulli ou Radarr/Sonarr sont indisponibles.
- Maintenabilite: separer les integrations externes du moteur metier pour faciliter les changements.

## Starter Template Evaluation

### Primary Technology Domain

Whatsarr est une application full-stack self-hosted avec backend d'integration, UI d'administration, workers planifies et adaptateur WhatsApp Web.

Le domaine technique principal est donc: TypeScript full-stack Node.js, structure monorepo legere.

### Starter Options Considered

**Option 1: Next.js full-stack avec create-next-app**

Next.js fournit un starter officiel avec TypeScript, ESLint, Tailwind, App Router et Turbopack via `pnpm create next-app`. Avantage: tres rapide pour une app web full-stack. Limite pour Whatsarr: moins naturel pour des workers longs, une session WhatsApp persistante et des integrations backend isolees. Le produit ressemble plus a un service backend avec UI qu'a une app web publique.

**Option 2: Create T3 App**

Create T3 App fournit un socle Next.js oriente full-stack TypeScript. Avantage: tres productif pour une app web avec base de donnees. Limite: il pousse vers un modele web-app/SSR alors que Whatsarr a surtout besoin d'un backend durable, d'un moteur d'evenements et d'un adaptateur WhatsApp isole.

**Option 3: NestJS backend + Vite React frontend**

NestJS fournit une architecture backend structuree via CLI officielle. Vite fournit un frontend React TypeScript simple et rapide. Avantage: bon decouplage entre API, workers, integrations et UI. NestJS est adapte aux modules, services, taches planifiees, files et clients externes. Limite: il faut assembler le monorepo nous-memes ou via Turborepo.

**Option 4: Turborepo monorepo + apps specialisees**

Turborepo fournit un starter monorepo officiel via `pnpm dlx create-turbo@latest`. Avantage: separer proprement `apps/web`, `apps/api`, `packages/shared`, et garder des scripts coherents. Limite: le starter de base n'est pas directement specialise NestJS + Vite; il faut adapter la structure.

### Selected Starter: Turborepo + NestJS API + Vite React UI

**Rationale for Selection:**

Le meilleur socle pour Whatsarr est un monorepo TypeScript avec separation nette:

- `apps/api`: NestJS pour API, workers, planification, integrations media et WhatsApp.
- `apps/web`: Vite React pour l'interface d'administration simple.
- `packages/shared`: types partages, schemas de validation, constantes metier.

Ce choix garde le backend durable au centre du systeme, ce qui correspond au vrai risque du projet: session WhatsApp Web, evenements, anti-doublons, retries et persistance.

**Initialization Commands:**

```bash
pnpm dlx create-turbo@latest whatsarr
cd whatsarr
pnpm dlx shadcn@latest init -t vite --monorepo
npx @nestjs/cli@latest new apps/api --strict
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript partout. Node.js LTS recommande pour production. Node.js 24 est l'Active LTS actuelle selon le calendrier Node.js.

**Styling Solution:**
Vite React avec shadcn/ui et Tailwind pour construire une interface simple, dense et familiere, proche des outils self-hosted modernes.

**Build Tooling:**
Turborepo orchestre les builds et scripts entre frontend, backend et packages partages.

**Testing Framework:**
NestJS fournit une base de test backend. Les tests frontend pourront etre ajoutes avec Vitest/Testing Library, et les tests E2E avec Playwright.

**Code Organization:**
Monorepo avec separation claire:

- `apps/web`
- `apps/api`
- `packages/shared`
- plus tard eventuellement `packages/integrations` si les clients Plex/TMDB/Tautulli deviennent volumineux.

**Development Experience:**
Developpement local avec hot reload cote API et UI, scripts centralises via Turbo, Docker Compose pour executer l'ensemble en condition self-hosted.

**Note:**
L'initialisation du monorepo et des deux apps doit etre la premiere story d'implementation.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Runtime: Node.js + TypeScript, monorepo Turborepo.
- Backend: NestJS API durable, pas Next.js full-stack.
- Frontend: Vite React UI simple.
- Database: SQLite en V1.
- ORM/migrations: Prisma.
- WhatsApp: adapter interne avec driver V1 `whatsapp-web.js` + Puppeteer/Chromium.
- Event processing: table d'outbox/jobs persistante en SQLite, pas Redis/BullMQ en V1.
- API: REST JSON + OpenAPI.
- Auth: single-admin password + session cookie HTTP-only.

**Important Decisions (Shape Architecture):**

- Zod ou DTO validation pour les payloads API.
- Server-Sent Events pour statuts live simples: QR WhatsApp, etats connexions, logs recents.
- Docker Compose mono-service applicatif avec volume persistant.
- Secrets stockes en base, masques dans l'UI, chiffrement local via cle applicative.

**Deferred Decisions (Post-MVP):**

- PostgreSQL, Redis/BullMQ, multi-admin, multi-session WhatsApp, multi-serveur Plex.
- Queue distribuee et workers separes.
- Auth OAuth/OIDC.

### Data Architecture

**Decision:** SQLite + Prisma en V1.

**Rationale:**
Projet personnel, mono-admin, mono-instance Docker. SQLite reduit la complexite de deploiement et correspond bien au besoin: configuration, mappings, logs, jobs, historique anti-doublon.

**Affects:**
Settings, secrets, contacts, utilisateurs Plex, mappings, templates, jobs, logs, historique anti-doublon, recap mensuel.

**Migration approach:**
Prisma Migrate avec migrations versionnees dans le repo.

**Caching strategy:**
Pas de cache distribue. Cache applicatif court en memoire uniquement pour statuts non critiques; toute decision anti-doublon ou job doit rester persistante.

### Authentication & Security

**Decision:** Auth single-admin locale.

**Pattern:**

- Premier lancement: creation du mot de passe admin.
- Connexion par session cookie HTTP-only.
- Pas de gestion de roles en V1.
- CORS limite a l'origine de l'UI.
- Rate limit sur login et endpoints sensibles.
- Secrets masques dans l'UI.
- Chiffrement des tokens/API keys en base avec une cle applicative.

**Rationale:**
Whatsarr est personnel mais expose une UI d'administration sensible. Meme derriere reverse proxy, une auth locale evite une app ouverte par erreur.

### API & Communication Patterns

**Decision:** REST JSON + OpenAPI.

**Rationale:**
L'UI est simple, les operations sont administratives, et REST suffit largement. OpenAPI aide les futurs agents et tests a comprendre les contrats.

**Realtime:**
Server-Sent Events pour:

- QR WhatsApp;
- etat de session WhatsApp;
- etat des integrations;
- derniers logs/messages.

**Webhooks:**
Endpoints REST dedies pour Plex/Tautulli/Overseerr si actives. Les scans planifies restent disponibles comme fallback. Le backend doit normaliser tous les signaux dans un routeur de source de verite avant creation d'annonce ou notification.

### Frontend Architecture

**Decision:** Vite React + shadcn/ui + Tailwind.

**Pattern:**

- Pages simples: Dashboard, Parametres, WhatsApp, Mapping, Templates, Logs.
- TanStack Query pour fetch/cache cote UI.
- React Hook Form pour formulaires.
- Zod si schemas partages retenus.
- Pas de state manager global lourd en V1.

**Rationale:**
Interface type Overseerr/Radarr: claire, operationnelle, pas une app marketing.

### Infrastructure & Deployment

**Decision:** Docker Compose local avec volume persistant.

**Pattern:**

- Un conteneur applicatif principal contenant API, UI servie statiquement, workers internes et composant WhatsApp.
- Volume `/data` pour SQLite, session WhatsApp, fichiers temporaires et logs.
- Variables d'environnement pour port, timezone, cle applicative, chemins.
- Healthcheck Docker exposant l'etat API + database.
- Logs stdout + logs persistants minimaux en base.

**WhatsApp Deployment Constraint:**
Le conteneur doit inclure Chromium/Puppeteer et les flags Linux necessaires au headless Docker. Le composant WhatsApp reste derriere une interface `WhatsAppAdapter` pour pouvoir remplacer `whatsapp-web.js` par une autre librairie plus tard.

### Decision Impact Analysis

**Implementation Sequence:**

1. Initialiser monorepo Turborepo + NestJS + Vite React.
2. Ajouter Docker Compose et volume `/data`.
3. Ajouter Prisma + SQLite + migrations initiales.
4. Ajouter auth single-admin.
5. Ajouter settings services + tests de connexion.
6. Ajouter WhatsAppAdapter + driver `whatsapp-web.js`.
7. Ajouter Groupe serveur + import contacts.
8. Ajouter mappings Plex/contact.
9. Ajouter moteur events/jobs/outbox.
10. Ajouter annonces, notifications, recap mensuel.
11. Ajouter logs, anti-doublon, retry.

**Cross-Component Dependencies:**

- WhatsApp depend de `/data` pour session persistante.
- Notifications dependent des mappings Plex/contact.
- Annonces dependent du routeur de source de verite: Overseerr pour films/saison 1, Plex pour saisons 2+; recaps dependent de TMDB/Plex/Tautulli selon le type.
- Anti-doublon depend de SQLite, pas de memoire process.
- UI depend de REST + SSE pour statuts live.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
Les risques de divergence principaux sont: nommage base/API/code, formats REST, gestion d'erreurs, structure monorepo, events/jobs, logs, validation, et gestion des etats UI.

### Naming Patterns

**Database Naming Conventions:**

- Tables SQLite en `snake_case` pluriel: `plex_users`, `whatsapp_contacts`, `message_templates`.
- Colonnes en `snake_case`: `created_at`, `updated_at`, `plex_user_id`.
- IDs primaires: `id`.
- Foreign keys: `{entity}_id`, exemple `plex_user_id`.
- Index: `idx_{table}_{columns}`, exemple `idx_notification_jobs_status`.

**API Naming Conventions:**

- REST endpoints en kebab-case pluriel: `/api/plex-users`, `/api/whatsapp-groups`.
- Route params NestJS en `:id`: `/api/plex-users/:id`.
- Query params en camelCase cote API publique: `?includeUnmapped=true`.
- JSON request/response en camelCase.
- Headers custom prefixes `X-Whatsarr-`.

**Code Naming Conventions:**

- TypeScript en camelCase pour variables/fonctions: `getPlexUsers`.
- Classes/services en PascalCase: `PlexService`, `WhatsAppAdapter`.
- Fichiers backend NestJS en kebab-case: `plex-users.service.ts`, `whatsapp-adapter.interface.ts`.
- Composants React en PascalCase: `ConnectionStatusCard.tsx`.
- Hooks React en camelCase avec prefixe `use`: `usePlexUsers`.

### Structure Patterns

**Project Organization:**

- `apps/api`: NestJS backend, workers, integrations.
- `apps/web`: Vite React UI.
- `packages/shared`: types, schemas, constantes, enums partages.
- Tests co-localises: `*.spec.ts` cote API, `*.test.tsx` cote UI.
- Pas de logique metier dans `apps/web`; l'UI appelle l'API.

**Backend Module Pattern:**
Chaque domaine backend suit:

- `*.module.ts`
- `*.controller.ts`
- `*.service.ts`
- `dto/`
- `repositories/` si acces DB non trivial
- `integrations/` pour clients externes
- `*.spec.ts`

Exemples modules:

- `settings`
- `auth`
- `plex`
- `tautulli`
- `overseerr`
- `tmdb`
- `whatsapp`
- `mapping`
- `notifications`
- `jobs`
- `logs`

**Frontend Structure Pattern:**

- `src/pages`
- `src/components`
- `src/features`
- `src/lib/api`
- `src/lib/sse`
- `src/hooks`
- `src/routes`

Les ecrans principaux sont: Dashboard, Parametres, WhatsApp, Mapping, Templates, Logs.

### Format Patterns

**API Response Formats:**

- Succes item: retour direct type, exemple `{ id, name, status }`.
- Succes liste: `{ items, total }`.
- Erreur: `{ error: { code, message, details?, requestId } }`.
- Dates JSON: ISO 8601 UTC strings.
- Champs JSON: camelCase.

**Data Exchange Formats:**

- Base de donnees: snake_case.
- API/UI: camelCase.
- Conversion Prisma/API faite dans les services ou mappers dedies.
- Pas d'exposition brute des modeles Prisma cote API.

### Communication Patterns

**Event System Patterns:**

- Events internes nommes en dot.case: `plex.media.available`, `overseerr.request.available`, `media.availability.routed`, `whatsapp.session.connected`.
- Payload minimal commun:
  - `eventId`
  - `type`
  - `source`
  - `occurredAt`
  - `payload`
- Les events qui peuvent declencher message doivent produire une cle anti-doublon deterministe.

**Job/Outbox Patterns:**

- Toute notification WhatsApp passe par une table `notification_jobs`.
- Un job contient: type, cible, payload, status, attempts, dedupe_key, scheduled_at, sent_at, failed_at.
- Aucun envoi WhatsApp direct depuis un controller.
- Les retries passent par le worker jobs.

**Logging Patterns:**

- Logs operationnels persistés pour evenements importants.
- Niveaux: `debug`, `info`, `warn`, `error`.
- Ne jamais logger les secrets, tokens, cookies WhatsApp ou cles API.
- Chaque erreur API inclut un `requestId`.

### Process Patterns

**Error Handling Patterns:**

- Erreurs metier typees avec `code` stable: `WHATSAPP_DISCONNECTED`, `TMDB_NOT_FOUND`, `PLEX_UNREACHABLE`.
- Les erreurs utilisateur sont courtes et exploitables.
- Les details techniques restent dans les logs.
- Les integrations externes doivent normaliser leurs erreurs avant de remonter au domaine.

**Loading State Patterns:**

- UI: TanStack Query gere loading/error/refetch.
- Actions longues: afficher statut en cours + resultat final.
- Connexion WhatsApp: etat live via SSE.
- Pas de polling rapide si SSE disponible.

**Validation Patterns:**

- Validation API a l'entree des controllers.
- Validation UI avant submit pour feedback rapide.
- Les schemas partages vivent dans `packages/shared` quand ils sont utilises cote API et UI.
- Les secrets sont valides par test de connexion, pas seulement par format.

### Enforcement Guidelines

**All AI Agents MUST:**

- Respecter snake_case en DB et camelCase en API/UI.
- Ne jamais envoyer de message WhatsApp directement hors outbox/jobs.
- Ne jamais exposer ou logger un secret.
- Ajouter une cle anti-doublon pour tout evenement qui peut produire un message.
- Garder WhatsApp derriere `WhatsAppAdapter`.
- Garder la logique metier cote API, pas cote React.
- Ajouter ou mettre a jour les tests autour des regles de notification et anti-doublon.

**Pattern Enforcement:**

- Toute nouvelle feature doit indiquer son module backend proprietaire.
- Toute nouvelle route doit apparaitre dans OpenAPI.
- Toute table Prisma doit respecter le nommage documente.
- Toute violation volontaire doit etre notee dans l'architecture ou l'addendum technique.

### Pattern Examples

**Good Examples:**

- Table: `notification_jobs`
- API: `GET /api/notification-jobs?status=failed`
- Event: `plex.media.available`
- Event route: `media.availability.routed`
- Error code: `WHATSAPP_SESSION_EXPIRED`
- Adapter: `WhatsAppAdapter.sendMessage(target, message)`

**Anti-Patterns:**

- Envoyer un message WhatsApp depuis `PlexController`.
- Stocker un token API en clair dans les logs.
- Utiliser `user_id` dans une reponse JSON.
- Creer une deuxieme file de jobs hors `notification_jobs`.
- Mettre une regle de filtrage "sortie recente" dans le frontend.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
whatsarr/
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── deployment.md
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── config/
│   │   │   │   ├── env.schema.ts
│   │   │   │   └── app-config.service.ts
│   │   │   ├── common/
│   │   │   │   ├── errors/
│   │   │   │   ├── filters/
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   ├── logging/
│   │   │   │   └── utils/
│   │   │   ├── database/
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── settings/
│   │   │   │   ├── plex/
│   │   │   │   ├── tautulli/
│   │   │   │   ├── overseerr/
│   │   │   │   ├── radarr/
│   │   │   │   ├── sonarr/
│   │   │   │   ├── tmdb/
│   │   │   │   ├── whatsapp/
│   │   │   │   │   ├── adapters/
│   │   │   │   │   │   ├── whatsapp-adapter.interface.ts
│   │   │   │   │   │   └── whatsapp-web-js.adapter.ts
│   │   │   │   │   ├── dto/
│   │   │   │   │   ├── whatsapp.controller.ts
│   │   │   │   │   ├── whatsapp.module.ts
│   │   │   │   │   └── whatsapp.service.ts
│   │   │   │   ├── mapping/
│   │   │   │   ├── templates/
│   │   │   │   ├── events/
│   │   │   │   ├── notifications/
│   │   │   │   ├── jobs/
│   │   │   │   ├── monthly-recap/
│   │   │   │   └── logs/
│   │   │   └── sse/
│   │   └── test/
│   │       ├── fixtures/
│   │       └── e2e/
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── routes/
│           ├── pages/
│           │   ├── DashboardPage.tsx
│           │   ├── SettingsPage.tsx
│           │   ├── WhatsAppPage.tsx
│           │   ├── MappingPage.tsx
│           │   ├── TemplatesPage.tsx
│           │   └── LogsPage.tsx
│           ├── features/
│           │   ├── auth/
│           │   ├── settings/
│           │   ├── whatsapp/
│           │   ├── mapping/
│           │   ├── templates/
│           │   └── logs/
│           ├── components/
│           │   ├── layout/
│           │   └── ui/
│           ├── lib/
│           │   ├── api/
│           │   ├── sse/
│           │   └── utils.ts
│           └── hooks/
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── schemas/
│           ├── types/
│           ├── constants/
│           └── events/
└── tests/
    └── e2e/
```

### Architectural Boundaries

**API Boundaries:**

- Toute communication UI -> backend passe par REST `/api/*`.
- Les statuts live passent par SSE.
- Les webhooks externes entrent par des controllers dedies.
- OpenAPI documente toutes les routes publiques.

**Component Boundaries:**

- `apps/web` ne contient aucune regle metier de notification.
- `apps/web` affiche, edite et declenche des actions API.
- `packages/shared` contient uniquement types, schemas, constantes et event contracts.

**Service Boundaries:**

- Les modules Plex/Tautulli/Overseerr/Radarr/Sonarr/TMDB encapsulent les clients externes.
- Le module WhatsApp expose uniquement `WhatsAppAdapter`.
- Le module Notifications orchestre les decisions d'envoi et consomme uniquement la disponibilite deja routee.
- Le module Events contient le routeur de source de verite media.
- Le module Jobs execute l'outbox et les retries.

**Data Boundaries:**

- Prisma est accessible via `database/prisma.service.ts`.
- Les controllers ne parlent pas directement a Prisma.
- Les modeles Prisma ne sont pas exposes bruts dans l'API.
- L'anti-doublon et les jobs sont persistés en SQLite.

### Requirements to Structure Mapping

**FR-1 a FR-2: Configuration services**

- API: `apps/api/src/modules/settings`
- UI: `apps/web/src/features/settings`, `SettingsPage.tsx`

**FR-3 a FR-5: Session WhatsApp**

- API: `apps/api/src/modules/whatsapp`
- Adapter: `apps/api/src/modules/whatsapp/adapters`
- UI: `apps/web/src/features/whatsapp`, `WhatsAppPage.tsx`

**FR-6 a FR-8: Groupe serveur et mapping**

- API: `apps/api/src/modules/mapping`
- UI: `apps/web/src/features/mapping`, `MappingPage.tsx`

**FR-9: Templates**

- API: `apps/api/src/modules/templates`
- UI: `apps/web/src/features/templates`, `TemplatesPage.tsx`

**FR-10 a FR-13: Annonces recentes**

- API: `apps/api/src/modules/events`, `notifications`, `tmdb`, `plex`, `overseerr`, `jobs`
- Regle: Overseerr source les films et saison 1; Plex source les saisons 2+ et les episodes individuels.

**FR-14 a FR-15: Notifications individuelles**

- API: `apps/api/src/modules/notifications`, `overseerr`, `tautulli`, `jobs`
- Regle: les demandes films/saison 1 viennent d'Overseerr; les nouvelles saisons et nouveaux episodes viennent de Plex, avec ciblage complete par demandes/suivis et historique.

**FR-16 a FR-18: Recap mensuel**

- API: `apps/api/src/modules/monthly-recap`, `tautulli`, `plex`, `jobs`

**FR-19 a FR-20: Logs et anti-doublon**

- API: `apps/api/src/modules/logs`, `jobs`, `notifications`
- UI: `apps/web/src/features/logs`, `LogsPage.tsx`

### Integration Points

**Internal Communication:**

- Controllers appellent services.
- Services metier appellent repositories et integrations.
- Notifications creent des `notification_jobs`.
- Jobs consomment l'outbox et appellent `WhatsAppAdapter`.

**External Integrations:**

- Plex: saisons 2+, nouveaux episodes individuels, utilisateurs, bibliotheques.
- Tautulli: historique visionnage, stats mensuelles.
- Overseerr: disponibilite films, disponibilite saison 1, demandes et demandeurs.
- Radarr/Sonarr: fallback ou enrichissement etat.
- TMDB: metadonnees, images, dates, titres FR.
- WhatsApp Web: groupes, contacts, envoi messages.

**Data Flow:**

1. Event externe ou scan planifie.
2. Normalisation en event interne source (`overseerr.request.available`, `plex.media.available`).
3. Routage source de verite en `media.availability.routed`.
4. Enrichissement Plex/TMDB/Tautulli/Overseerr.
5. Application regles metier.
6. Creation job avec `dedupe_key`.
7. Worker jobs.
8. Envoi via `WhatsAppAdapter`.
9. Log resultat et statut.

### File Organization Patterns

**Configuration Files:**

- Root `.env.example` pour variables globales.
- `apps/api/src/config` pour validation env et acces config.
- Secrets utilisateur persistés en SQLite, pas dans `.env`.

**Source Organization:**

- Backend organise par modules metier.
- Frontend organise par pages + features.
- Shared reserve aux contrats partages.

**Test Organization:**

- Unit tests co-localises avec services/composants.
- E2E backend dans `apps/api/test/e2e`.
- E2E complet UI/API dans `tests/e2e`.

**Asset Organization:**

- Assets UI statiques dans `apps/web/src/assets` si necessaire.
- Donnees runtime dans `/data` cote Docker, jamais dans le repo.

### Development Workflow Integration

**Development Server Structure:**

- `apps/api` demarre NestJS en watch.
- `apps/web` demarre Vite.
- Turbo orchestre `dev`, `build`, `test`, `lint`.

**Build Process Structure:**

- Build API NestJS.
- Build UI Vite en fichiers statiques.
- Image Docker sert l'UI et l'API depuis le conteneur applicatif.

**Deployment Structure:**

- Docker Compose lance un service `whatsarr`.
- Volume `/data` contient SQLite, session WhatsApp et etat persistant.
- Healthcheck verifie API + database.

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**
Les decisions principales sont compatibles: TypeScript monorepo, NestJS backend, Vite React frontend, SQLite/Prisma, REST/OpenAPI, SSE, Docker Compose et WhatsApp Web via adapter isole fonctionnent ensemble sans conflit majeur.

Le choix SQLite + outbox persistante est coherent avec le scope mono-admin/mono-instance. Le report de Redis/BullMQ evite une dependance inutile en V1.

**Pattern Consistency:**
Les patterns soutiennent les decisions: snake_case en base, camelCase API/UI, REST JSON, events dot.case, jobs persistés, adapter WhatsApp isole, regles metier cote backend.

**Structure Alignment:**
La structure monorepo supporte les frontieres attendues: `apps/api` pour logique durable, `apps/web` pour UI, `packages/shared` pour contrats. Les modules backend couvrent les domaines du PRD.

### Requirements Coverage Validation

**Feature Coverage:**
Tous les blocs fonctionnels du PRD ont une place architecturale: settings, auth, Plex/Tautulli/Overseerr/Radarr/Sonarr/TMDB, WhatsApp, mapping, templates, events, notifications, jobs, monthly-recap, logs.

**Functional Requirements Coverage:**
Les FR-1 a FR-20 sont couverts par les modules et patterns documentes.

**Non-Functional Requirements Coverage:**

- Fiabilite: volume `/data`, SQLite, session WhatsApp persistante, jobs persistés.
- Observabilite: logs, statuts, SSE, historique jobs.
- Confidentialite: secrets masques, logs filtres, chiffrement local prevu.
- Simplicite UI: Vite React + shadcn/ui, pages simples.
- Degradation: services externes encapsules, erreurs normalisees.

### Implementation Readiness Validation

**Decision Completeness:**
Les decisions bloquantes sont documentees. Les versions exactes seront figees au moment du scaffold via les commandes `latest`, mais les familles technologiques sont stables.

**Structure Completeness:**
La structure est assez precise pour creer les premieres stories et eviter les conflits de placement.

**Pattern Completeness:**
Les conventions de nommage, formats API, jobs, events, erreurs, logs, validation et UI sont suffisantes pour guider plusieurs agents.

### Gap Analysis Results

**Critical Gaps:**
Aucun gap critique ouvert.

**Important Gaps:**

- Le driver WhatsApp Web exact est choisi pour V1 (`whatsapp-web.js`), mais il faudra valider en spike Docker reel.
- Le choix final entre Plex direct et Tautulli pour certaines statistiques doit etre confirme par tests d'API.
- La strategie de retry WhatsApp doit etre precisee dans les stories jobs.

**Nice-to-Have Gaps:**

- Ajouter plus tard un diagramme de flux.
- Ajouter plus tard un guide de variables d'environnement.
- Ajouter plus tard une matrice evenements -> notifications.

### Validation Issues Addressed

Aucune contradiction bloquante trouvee. Les risques principaux sont deja isoles par l'architecture: WhatsApp derriere adapter, jobs persistés, anti-doublon centralise, integrations externes encapsulees.

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** high

**Key Strengths:**

- Backend durable place au centre, adapte au vrai risque du projet.
- WhatsApp isole derriere adapter.
- Anti-doublon et jobs persistés des la V1.
- Structure simple mais extensible.
- Scope coherent avec usage personnel mono-admin.

**Areas for Future Enhancement:**

- Redis/BullMQ si les retries/jobs deviennent plus lourds.
- PostgreSQL si multi-instance ou volume de donnees important.
- Multi-session WhatsApp.
- Multi-admin et permissions.
- Observabilite plus avancee.

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented.
- Use implementation patterns consistently across all components.
- Respect project structure and boundaries.
- Never send WhatsApp messages outside the jobs/outbox pipeline.
- Keep WhatsApp implementation behind `WhatsAppAdapter`.
- Put business rules in `apps/api`, not in `apps/web`.

**First Implementation Priority:**
Initialiser le monorepo Turborepo + NestJS API + Vite React UI, puis ajouter Docker Compose, Prisma SQLite et le volume `/data`.
