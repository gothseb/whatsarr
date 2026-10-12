# Story 6.2 : Joindre une photo au message Hermes

Status: review

Story Key: `6-2-joindre-une-photo-au-message-hermes`
Date de préparation : 2026-10-12

## Story

En tant qu'administrateur utilisant Hermes,
je veux que l'agent accompagne ses conseils d'une photo,
afin que le groupe WhatsApp reçoive une publication contenant une image et sa légende.

## Contexte et dépendances

- Epic 6 ; exigences FR21, FR22 photo, FR23, FR24 photo, NFR3, NFR5, NFR9, NFR10.
- Prérequis de développement : story 6.1, API texte locale et job Hermes dédupliqué.
- Les stories 6.1 à 6.6 sont des spécifications ; aucun module agent n'est encore implémenté lors de cette rédaction.
- Vérifier les fichiers effectivement livrés par 6.1 avant de commencer ; les chemins agent ci-dessous sont des cibles convenues.
- La story 6.3 étendra le suivi, mais cette story doit déjà persister correctement les statuts et erreurs existants.
- Hermes conserve la rédaction, la sélection de l'image et la planification des publications.
- Aucune clé Hermes, aucun cookie, aucune nouvelle configuration de groupe ou de service.
- V1 : une seule photo distante HTTP(S), JPEG/PNG, pas de multipart, base64 entrant, album ou upload local.

## Acceptance Criteria

### AC1 — Une photo et une légende dans une seule publication

**Given** le Groupe serveur est configuré et la story 6.1 est disponible,
**When** `POST /api/agent/messages` reçoit `{ messageId, text, imageUrl }`,
**Then** le job contient la référence image et le worker envoie une seule photo avec `text` comme légende.
**And** aucun message texte supplémentaire n'est envoyé et le contrôleur ne télécharge ni n'envoie l'image.
**And** l'absence de `imageUrl` conserve exactement le chemin texte seul.

### AC2 — URL utilisable sur le réseau local

**Given** une URL HTTP(S) absolue joignable depuis le processus ou conteneur Whatsarr,
**When** la requête est validée puis téléchargée par le worker,
**Then** les adresses privées, IP locales et noms DNS de services LAN sont autorisés.
**And** `file:`, `data:`, les chemins locaux et les URL avec `username`/`password` sont rejetés.
**And** chaque destination de redirection respecte les mêmes règles ; aucune clé Plex/Tautulli ni cookie n'est transmis.

### AC3 — Limites de légende et validation synchrone

**Given** un corps de requête invalide,
**When** la légende dépasse 1000 caractères ou l'URL est invalide,
**Then** HTTP 400 `AGENT_INVALID_REQUEST` est retourné avant toute création de job.
**And** `text` reste obligatoire et non vide après contrôle des espaces ; le texte seul conserve sa limite de 4000 caractères.
**And** les champs inconnus, y compris une cible arbitraire, restent interdits et le texte original n'est ni interpolé ni tronqué.

### AC4 — Téléchargement contrôlé, une seule fois par tentative

**Given** un job Hermes photo en cours,
**When** une image JPEG/PNG valide arrive dans un budget total de 15 secondes avec au plus 10 Mio,
**Then** les mêmes octets contrôlés sont remis à l'adapter et envoyés avec la légende.
**And** la taille est vérifiée pendant le flux, même sans `Content-Length` ou avec une taille annoncée mensongère.
**And** il n'y a aucun second téléchargement via `MessageMedia.fromUrl` après la validation.

### AC5 — Erreurs explicites et ressources libérées

**Given** un échec HTTP/réseau, un timeout, une image vide/non autorisée ou une limite dépassée,
**When** le worker traite la tentative,
**Then** le job suit `retry_scheduled`, puis `failed` après le budget existant de trois tentatives.
**And** l'erreur persistée est identifiable et nettoyée ; aucun fallback texte seul n'est effectué.
**And** les lecteurs, connexions, temporisateurs et éventuels fichiers temporaires sont libérés.
**And** les erreurs d'envoi restent distinctes des erreurs de log après envoi réussi.

### AC6 — Identité du message incluant la référence photo

**Given** un `messageId` Hermes accepté,
**When** une répétition conserve exactement le texte et l'URL,
**Then** HTTP 200 renvoie le même job avec `deduplicated: true` et aucun téléchargement additionnel à l'entrée API.
**When** le texte ou l'URL change, ou qu'une photo est ajoutée/supprimée,
**Then** HTTP 409 `AGENT_MESSAGE_ID_CONFLICT` conserve intégralement le job et sa cible d'origine.
**And** l'identité est globale à Hermes, indépendante du groupe courant et du `requestId` technique.

### AC7 — Compatibilité et documentation

**Given** le contrat photo est livré,
**When** les tests et exemples sont exécutés,
**Then** les photos LAN, MIME/octet invalides, redirections, dépassements, timeout et répétitions sont vérifiés.
**And** les annonces avec affiche, notifications personnelles et récaps existants gardent leur rendu et leurs retries.
**And** le guide indique qu'Hermes doit conserver l'image stable et disponible jusqu'à l'état terminal du job.

## Tasks / Subtasks

- [x] 1. Étendre le DTO et le contrat de 6.1 (AC1, AC2, AC3, AC6).
  - [x] 1.1 Ajouter `imageUrl?: string` ; omission seulement signifie absence, rejeter `null`, chaîne vide et non-string à l'entrée.
  - [x] 1.2 Valider URL absolue, protocoles HTTP(S), absence d'identifiants, et longueur `text` selon présence de photo.
  - [x] 1.3 Persister `mediaUrl: imageUrl ?? null` dans le payload agent ; ne pas modifier les anciennes formes template.
  - [x] 1.4 Comparer `{ text, mediaUrl }` au doublon trouvé avant résolution du groupe ; conserver l'URL fournie pour comparaison exacte.
- [x] 2. Créer un téléchargement photo borné (AC2, AC4, AC5).
  - [x] 2.1 Ajouter un service injectable local au module agent, utilisant `fetch` natif et lecteur du `Response.body`.
  - [x] 2.2 Utiliser une seule échéance 15 000 ms pour toutes les redirections et la lecture du corps.
  - [x] 2.3 Suivre les redirections manuellement, maximum cinq, résoudre `Location` relative et revalider chaque URL.
  - [x] 2.4 Refuser statut non-2xx, flux absent/vide, mauvais type ; compter les octets effectivement lus jusqu'à 10 485 760.
  - [x] 2.5 Vérifier MIME JPEG/PNG et signatures binaires correspondantes, rejeter incohérences MIME/signature et contenu HTML.
  - [x] 2.6 Annuler le flux et le fetch en erreur, libérer reader et timer dans `finally`.
- [x] 3. Adapter la frontière WhatsApp sans double téléchargement (AC1, AC4, AC7).
  - [x] 3.1 Définir un type média transport `{ mimetype, data: Buffer, filename, filesize }` côté API, sans objet wwebjs hors adapter.
  - [x] 3.2 Ajouter une méthode `sendMedia(targetId, caption, media)` à `WhatsAppAdapter` et aux mocks typés.
  - [x] 3.3 Construire `new MessageMedia(mimetype, data.toString("base64"), filename, filesize)` dans le driver uniquement.
  - [x] 3.4 Appeler une fois `client.sendMessage(targetId, media, { caption })` ; conserver `sendMessage(..., mediaUrl)` legacy.
- [x] 4. Connecter le worker à la photo agent (AC1, AC4, AC5, AC6).
  - [x] 4.1 Brancher seulement le payload `kind: "agent_message"`, source `hermes`, sur téléchargement puis `sendMedia`.
  - [x] 4.2 Garder le texte brut, `targetId` épinglé à l'acceptation, un job et une seule progression d'attempts.
  - [x] 4.3 Préserver traitement par lot, verrou mono-processus, retard `attempts * 60_000`, et journalisation hors try d'envoi réussi.
  - [x] 4.4 Définir des erreurs stables et messages nettoyés ; ne jamais journaliser URL complète, query, fragments ou bytes.
- [x] 5. Tester puis documenter (AC1 à AC7).
  - [x] 5.1 Couvrir DTO/service, téléchargement simulé, worker et driver mocké, ainsi que déduplication concurrente SQLite photo.
  - [x] 5.2 Étendre `docs/hermes-agent.openapi.json` et `docs/hermes-agent.md` avec exemples et limites.
  - [x] 5.3 Exécuter tests API, lint et build du monorepo ; reporter les vérifications et limites dans le Dev Agent Record.

## Dev Notes

### Contrat HTTP et persistance

```http
POST /api/agent/messages
Content-Type: application/json
```

```json
{
  "messageId": "conseil-2026-10-12-dune-photo",
  "text": "Ce soir : Dune. Disponible sur Plex.\nUn conseil préparé par Hermes.",
  "imageUrl": "http://hermes:8080/photos/dune.jpg"
}
```

Première acceptation : HTTP 202 ; répétition identique : HTTP 200.

```json
{
  "jobId": "cm_example",
  "messageId": "conseil-2026-10-12-dune-photo",
  "status": "pending",
  "deduplicated": false,
  "requestId": "req-current-post"
}
```

Payload JSON persistant convenu avec 6.1 :

```json
{
  "kind": "agent_message",
  "source": "hermes",
  "messageId": "conseil-2026-10-12-dune-photo",
  "text": "Ce soir : Dune. Disponible sur Plex.\nUn conseil préparé par Hermes.",
  "mediaUrl": "http://hermes:8080/photos/dune.jpg"
}
```

- Clé unique : `job:agent:hermes:${messageId}` ; pas de groupId ou hash du texte dans cette clé.
- Le groupe initial reste dans `NotificationJob.targetId` ; la photo n'introduit aucune migration de table obligatoire.
- `requestId` du POST désigne la requête courante ; `NotificationJob.requestId` garde celui de la première acceptation.
- `imageUrl` fourni est comparé exactement ; ne pas considérer arbitrairement deux URL comme identiques après normalisation.
- Revalider le payload persistant au traitement ; un JSON malformé ne doit jamais retomber sur le template announcement.
- Une URL peut évoluer entre deux retries : la V1 garantit l'identité de référence, pas une empreinte du fichier distant.

### Téléchargement et erreurs

Budget 15 s appliqué au téléchargement, incluant redirections et lecture ; il ne prétend pas borner le transport WhatsApp.
Comme en 6.1, compter le texte avec `.length` JavaScript, en unités UTF-16 : 1000 pour la légende et 4000 sans photo.
Ne pas utiliser `@MaxLength` ou `maxLength` OpenAPI seuls : ils comptent les points de code ; documenter `x-maxUtf16Length` et tester les emojis.
Compter la longueur des chunks délivrés à l'application, y compris si HTTP annonce un corps compressé.
Le buffer binaire est limité à 10 Mio ; le base64 consomme davantage de mémoire mais reste dérivé d'un buffer borné.
Rejeter un `Content-Length` trop grand avant lecture ; un header absent/petit n'exonère jamais du compteur réel.
Ne pas utiliser `response.arrayBuffer()` sur une réponse non bornée ni un simple `Promise.race` laissant le flux ouvert.
Ne pas transférer les headers entrants Hermes vers l'hôte image ; utiliser uniquement les headers du downloader.
Garder `filename` généré par l'application (`hermes-photo.jpg`/`.png`), pas un nom de fichier arbitraire distant.
Les contrôles MIME/signature sont un contrôle de format V1, pas une promesse de validation complète par décodeur d'image.

| Code interne proposé | Condition | Résultat worker |
| --- | --- | --- |
| `AGENT_IMAGE_UNREACHABLE` | Échec réseau ou statut HTTP non réussi | Retry, puis échec terminal |
| `AGENT_IMAGE_TIMEOUT` | Budget 15 s écoulé | Annulation puis retry |
| `AGENT_IMAGE_TOO_LARGE` | Taille annoncée/réelle supérieure à 10 Mio | Annulation puis retry |
| `AGENT_IMAGE_INVALID` | Corps vide, mauvais MIME/signature | Retry, puis échec terminal |
| `AGENT_IMAGE_REDIRECT_INVALID` | Destination interdite/boucle/plus de cinq sauts | Arrêt puis retry |

Ces erreurs asynchrones deviennent `lastError` nettoyée ; le POST n'attend pas la disponibilité de l'image.

### Project Structure Notes : fichiers à toucher

| Chemin / opération | État actuel | Changement attendu | À préserver |
| --- | --- | --- | --- |
| `apps/api/src/modules/agent/agent.dto.ts` — UPDATE après 6.1 | Fichier absent au relevé ; cible DTO texte de 6.1 | Option image et limite de légende | Validation stricte, pas de cible arbitraire |
| `apps/api/src/modules/agent/agent.service.ts` — UPDATE après 6.1 | Absent ; cible déduplication de 6.1 | Comparer et persister mediaUrl | Anti-doublon base, groupe épinglé, conflits |
| `apps/api/src/modules/agent/agent-image.service.ts` — NEW | Aucun downloader Hermes | Téléchargement borné autonome | Pas de dépendance aux identifiants médias |
| `apps/api/src/modules/notifications/notifications.types.ts` — UPDATE | Type job template et NotificationPayload unique | Étendre l'union agent créée par 6.1 pour mediaUrl | Quatre types legacy et variables template |
| `apps/api/src/modules/notifications/notifications.service.ts` — UPDATE | Rend template, envoie via adapter ; 3 retries, lots de 10/15 s | Branche photo agent et erreurs de downloader | Rendu legacy, isolation des jobs et log après sent |
| `apps/api/src/modules/notifications/notifications.module.ts` — UPDATE | Importe Auth, Database, Templates, WhatsApp | Fournir le downloader sans dépendance circulaire Agent/Notifications | Contrôleur admin protégé et service exporté |
| `apps/api/src/modules/whatsapp/whatsapp.types.ts` — UPDATE | Interface sendMessage avec URL optionnelle | Ajouter transport média et sendMedia | Connexion, groupes, status$ et méthode legacy |
| `apps/api/src/modules/whatsapp/adapters/whatsapp-web-js.adapter.ts` — UPDATE | fromUrl puis sendMessage caption pour affiche legacy | sendMedia depuis octets contrôlés | LocalAuth, QR, restauration, path Chromium |
| `apps/api/src/modules/whatsapp/whatsapp.service.spec.ts` — UPDATE | Mock typé WhatsAppAdapter incomplet après extension | Ajouter mock sendMedia | Assertions de remplacement session/groupe |
| `apps/api/src/modules/notifications/notifications.service.spec.ts` — UPDATE | Tests déduplication, retries et erreur de log | Ajouter branche photo et média en erreur | Tests payload corrompu, continuation des lots |
| `docs/hermes-agent.openapi.json`, `docs/hermes-agent.md` — UPDATE après 6.1 | Documents à créer par 6.1 | Schéma image et exemples photo | Contrat texte, GET openapi.json et autres routes |

Enregistrer directement AgentImageService dans les providers de NotificationsModule ; conserver AgentModule comme façade qui importe NotificationsModule.
Ne pas importer AgentModule dans NotificationsModule : cela créerait un cycle. Le downloader n'importe ni AgentService ni NotificationsService.
Ne pas déplacer le driver vers `packages/shared`, ni créer un second client WhatsApp ou une seconde file.

### Testing Requirements

Tests co-localisés Vitest : `agent-image.service.spec.ts`, `agent.service.spec.ts`, `notifications.service.spec.ts`, `whatsapp-web-js.adapter.spec.ts`.
Downloader : source contrôlée JPEG/PNG, IP privée, redirection relative/URL credentials, cinq/six sauts, mauvaise signature et HTML sous MIME image.
Bornes : 10 485 760 octets accepté, +1 rejeté ; header absent, mensonger et trop grand ; flux bloqué après les headers annulé à 15 s.
Worker : sendMedia appelé une fois, sendMessage jamais pour photo, bytes transmis identiques, aucun fallback texte.
Retries : une seule ligne persistante, incrément 1/2/3, erreur terminale explicite, zéro renvoi après erreur de log post-sent.
DTO : `text` 1000/1001 unités UTF-16 avec photo, 4000/4001 sans photo, emojis, whitespace, imageUrl vide/null/non-string, champs inattendus.
Identité : mêmes requêtes simultanées, URL différente, ajout/suppression photo, groupe changé après acceptation.
Driver mocké : constructeur MessageMedia reçoit MIME/base64 contrôlés, caption identique ; legacy fromUrl inchangé.
Ne pas dépendre d'un vrai Plex, WhatsApp, ni réseau public pour les tests automatiques.

```sh
pnpm --filter @whatsarr/api test
pnpm lint
pnpm build
```

### Intelligence précédente et recherche technique

Le code récent isole les erreurs d'un job pour continuer le lot et sépare les logs après un envoi réussi ; reproduire cette discipline.
Les commits `d72d82a`, `e5d5d5f`, `89e7154` portent sur filtre de nouveauté, bibliothèques et disponibilité : ne pas appliquer ces règles aux posts Hermes.
Version installée/verrouillée de whatsapp-web.js : 1.34.7 ; Docker utilise Node 24. Aucun upgrade requis pour cette story.
[MessageMedia officiel](https://docs.wwebjs.dev/MessageMedia.html) documente le constructeur depuis MIME et base64 : l'adapter peut réutiliser les octets téléchargés.
[AbortSignal officiel](https://nodejs.org/api/globals.html#class-abortsignal) et [Web Streams officiel](https://nodejs.org/api/webstreams.html) sont les références de l'annulation et du lecteur ; ces pages décrivent la version courante du site, confirmer au développement sur Node 24 réellement utilisé par Docker.
Les limites de 1000 caractères, 10 Mio et 15 s sont des choix applicatifs Whatsarr, pas des limites garanties par WhatsApp.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` # Epic 6 / Story 6.2 et conventions communes]
- [Source: `_bmad-output/planning-artifacts/architecture.md` # Data Architecture / Job-Outbox Patterns / Architectural Boundaries]
- [Source: `apps/api/src/modules/notifications/notifications.service.ts` # processJob / processDueJobs / sanitize]
- [Source: `apps/api/src/modules/whatsapp/adapters/whatsapp-web-js.adapter.ts` # sendMessage / requireConnectedClient]
- [Source: `apps/api/prisma/schema.prisma` # NotificationJob / OperationalLog]
- [Source: `apps/api/src/main.ts` # ValidationPipe / global prefix]
- [Source: `pnpm-lock.yaml` # whatsapp-web.js@1.34.7 ; `Dockerfile` # node:24-bookworm-slim]

## Préparation de la story

Contexte établi le 12 octobre 2026 avec BMAD create-story et sa checklist ; critères, tâches, interfaces, limites et régressions analysés.
Cette préparation documentaire ne constitue ni une implémentation ni une preuve de tests passés.

## Dev Agent Record

### Agent Model Used

Codex — implementation BMAD sequentielle.

### Debug Log References

116 tests API passes ; lint API et builds API/shared/web passes. Tests downloader, driver mocke, worker et concurrence SQLite photo executes.

### Completion Notes List

- Photo optionnelle LAN, validation stricte et legende UTF16 <=1000 ; identite incluant reference exacte.
- Downloader streaming borne 10 Mio/15s, MIME/signature, redirections manuelles et annulation ; erreurs stables sans URL sensible.
- sendMedia envoie les memes bytes verifies ; aucun fallback texte, adapter legacy preserve.
- Downloader fourni par NotificationsModule pour eviter cycle DI.

- Les tests automatiques utilisent une base SQLite temporaire et des services controles ; aucune publication de test vers le groupe reel.
- Aucun smoke test avec Plex/Tautulli/WhatsApp reel effectue ; verification en conditions locales reelles a faire avec l'administrateur.

### File List

- `_bmad-output/implementation-artifacts/6-2-joindre-une-photo-au-message-hermes.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

- `apps/api/src/modules/agent/agent.types.ts`
- `apps/api/src/modules/agent/agent.dto.ts`
- `apps/api/src/modules/agent/agent.dto.spec.ts`
- `apps/api/src/modules/agent/agent-image.service.ts`
- `apps/api/src/modules/agent/agent-image.service.spec.ts`
- `apps/api/src/modules/agent/agent.integration.spec.ts`
- `apps/api/src/modules/agent/hermes-openapi.ts`
- `apps/api/src/modules/notifications/notifications.module.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/notifications/notifications.service.spec.ts`
- `apps/api/src/modules/whatsapp/whatsapp.types.ts`
- `apps/api/src/modules/whatsapp/whatsapp.service.spec.ts`
- `apps/api/src/modules/whatsapp/adapters/whatsapp-web-js.adapter.ts`
- `apps/api/src/modules/whatsapp/adapters/whatsapp-web-js.adapter.spec.ts`
- `docs/hermes-agent.openapi.json`
- `docs/hermes-agent.md`

## Change Log

- 2026-10-12 : implementation et verification story 6.2, prete pour revue.
