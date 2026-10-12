# Story 6.1: Envoyer un texte Hermes au groupe WhatsApp sans cle et sans doublon

Status: review

Story Key: `6-1-envoyer-un-texte-hermes-au-groupe-whatsapp`
Date de preparation: 2026-10-12
Epic: 6 — Permettre a Hermes de consulter les medias et publier dans le groupe WhatsApp

## Story

En tant qu’administrateur utilisant Hermes,
je veux que mon agent soumette ses textes a Whatsarr sans connexion et sans doublon,
afin que ses news et conseils soient publies dans le groupe deja configure.

## Requirements Traceability

FR21, FR22 (texte), FR23, FR24 ; NFR1, NFR2, NFR3, NFR6, NFR7, NFR8, NFR10.
Cette story livre a elle seule un chemin complet POST -> job persistant -> worker -> WhatsApp. Les photos arrivent en 6.2 ; le GET de suivi arrive en 6.3. Ne pas retarder le fonctionnement texte pour ces stories futures.

## Acceptance Criteria

### AC1

**Given** un Groupe serveur est configure
**When** Hermes appelle `POST /api/agent/messages` avec `{ messageId, text }` sans cle, token ou cookie
**Then** Whatsarr cree un job persistant de type `agent_message` pour ce groupe et retourne HTTP 202 avec `{ jobId, messageId, status, deduplicated: false, requestId }`
**And** le controller ne contacte pas directement WhatsApp, et le worker envoie le texte fourni via `WhatsAppAdapter`, sans template d'annonce ni filtre de nouveautes recentes.

### AC2

**Given** un message Hermes contient des retours a la ligne ou du texte `{{title}}`
**When** le worker rend ce job
**Then** le texte est conserve tel que fourni, sans interpolation de variables
**And** les anciens payloads de notifications continuent de suivre leur rendu par template.

### AC3

**Given** le job existe deja pour le meme `messageId` et le meme contenu
**When** Hermes repete la requete, y compris simultanement ou apres redemarrage
**Then** l'API retourne le meme `jobId`, son statut actuel et `deduplicated: true`, sans nouveau job
**And** HTTP 200 distingue cette repetition de la premiere acceptation HTTP 202 ; la contrainte d'unicite en base et le traitement des conflits concurrents garantissent ce comportement.

### AC4

**Given** un `messageId` existant est reutilise avec un texte different
**When** Hermes soumet la requete
**Then** l'API retourne HTTP 409 avec `AGENT_MESSAGE_ID_CONFLICT`
**And** le job original, son contenu et sa cible restent inchanges ; l'identite du message est propre a la source Hermes, distincte du `requestId` technique.

### AC5

**Given** le Groupe serveur change apres la premiere acceptation
**When** Hermes repete le meme message
**Then** l'API retrouve le job original sans creer un envoi vers le nouveau groupe
**And** seuls les nouveaux `messageId` utilisent le groupe courant ; les jobs acceptes conservent leur cible.

### AC6

**Given** `messageId` est absent, vide ou depasse 128 caracteres, ou `text` est absent, vide apres verification des espaces ou depasse 4000 caracteres
**When** Hermes soumet le message, ou ajoute un champ de cible arbitraire
**Then** l'API retourne HTTP 400 avec `AGENT_INVALID_REQUEST` sans creer de job
**And** si aucun groupe n'est configure pour un nouveau message, elle retourne HTTP 409 avec `WHATSAPP_GROUP_NOT_SELECTED` ; la recherche d'un doublon deja accepte precede cette verification.

### AC7

**Given** WhatsApp est deconnecte apres acceptation ou l'envoi echoue
**When** le worker traite le job
**Then** le job suit les retries limites et statuts existants sans nouveau job
**And** une erreur de journalisation apres un envoi reussi ne reprogramme pas l'envoi ; l'acceptation du webhook ne promet jamais un envoi deja realise.

### AC8

**Given** l'authentification administrateur est activee
**When** les tests appellent cette route sans cookie, puis une route administrateur protegee
**Then** la route agent fonctionne et la route administrateur reste protegee
**And** les tests couvrent les repetitions concurrentes avec SQLite, le redemarrage, les conflits, les erreurs de validation et la preservation des notifications par template.

## Tasks / Subtasks

- [x] T1 — Creer la facade agent et son contrat public (AC1, AC6, AC8)
  - [x] Ajouter `agent.module.ts`, `agent.controller.ts`, `agent.service.ts`, `agent.dto.ts` et les types de reponse ; importer AgentModule dans AppModule.
  - [x] Exposer POST `/api/agent/messages`, sans AuthGuard, sans verification de cle ni cookie ; conserver les autres controllers proteges.
  - [x] Valider un corps JSON objet strict ; refuser champs inconnus, valeurs null, tableau, booleens et nombres a la place des strings.
  - [x] Ajouter le filtre d'erreur et la correlation limites aux routes agent ; convertir aussi les erreurs du ValidationPipe en enveloppe agent.
  - [x] Ajouter un pipe agent qui refuse explicitement une racine JSON null, scalaire ou tableau ; normaliser aussi les erreurs de parsing JSON avant controller sur les chemins agent.
- [x] T2 — Creer un job Hermes atomique (AC1, AC3, AC4, AC5, AC6)
  - [x] Reutiliser NotificationJob, son dedupeKey unique et PrismaService ; aucune nouvelle table necessaire.
  - [x] Ajouter une methode metier de creation Hermes qui retourne le job et une information fiable `created`/`deduplicated`.
  - [x] Rechercher d'abord le job par dedupeKey ; comparer son payload immutable ; puis seulement resoudre le groupe courant si nouveau message.
  - [x] Traiter P2002 par relecture du gagnant et comparaison ; ne jamais upsert avec un update qui ecrase texte ou groupe.
  - [x] Garantir que les erreurs de journalisation apres insertion ne font pas perdre l'identite du job ni creer un second job.
- [x] T3 — Etendre le worker pour le texte brut (AC1, AC2, AC7)
  - [x] Ajouter un payload agent distingue explicitement des payloads legacy par type/kind ; valider le contenu avant envoi.
  - [x] Ajouter `agent_message` a NotificationJobType sans en faire un TemplateType ; ne pas creer de template editable Hermes.
  - [x] Brancher le rendu sur le type de job ; envoyer le texte exact avec `mediaUrl: null` via l'adapter existant.
  - [x] Preserver essais limites, reprise des jobs pending, isolation des erreurs par job et separation des erreurs d'envoi et erreurs post-envoi.
- [x] T4 — Ajouter schemas et guide utilisables par Hermes (AC1 a AC8)
  - [x] Ajouter `docs/hermes-agent.openapi.json` OpenAPI 3.0.3 avec la route implementee, ses reponses et `security: []`.
  - [x] Exposer GET `/api/agent/openapi.json` depuis le module agent via un document importe/embarque dans le build, sans dependance a un fichier non copie en Docker.
  - [x] Ajouter `docs/hermes-agent.md` : URL locale, exemple curl, messageId stable, retries client, queue et limites ; aucun Bearer token.
  - [x] Ne pas documenter les routes futures comme disponibles avant leur implementation.
- [x] T5 — Verifier bout en bout et les regressions (AC1 a AC8)
  - [x] Ajouter tests HTTP Nest pour routes publiques, validation, codes200/202/400/409 et acces administrateur preserve.
  - [x] Ajouter tests worker texte brut et tous templates legacy ; couvrir un texte litteral `{{title}}` et les retours a la ligne.
  - [x] Ajouter test d'integration avec SQLite temporaire, requetes concurrentes, fermeture/reouverture de client et un seul job persistant.
  - [x] Verifier changement/suppression de groupe, conflit de contenu, erreur des logs, deconnexion WhatsApp et budget de retry.
  - [x] Executer tests API, lint et build ; enregistrer les preuves reelles dans Dev Agent Record lors du developpement.

## Dev Notes

### Decision produit et dependances

Seb a explicitement demande une integration locale sans cle. Les routes agent fonctionnent aussi lorsque `AUTH_DISABLED=false`. Ne pas ajouter une cle optionnelle obligatoire par defaut, une allowlist de machines, une signature ou une etape de connexion. L'interface administrateur et ses routes restent sous leur politique existante.

Prerequis deja presents : settings/secrets (epic1), Groupe serveur et session (epic2), outbox/worker (epic4). Aucune dependance au mapping utilisateur de l'epic3. Aucun fichier6.x n'etait implemente au moment de la preparation : tous les chemins NEW ci-dessous sont a creer.

### Contrat HTTP ferme pour cette story

| Champ du POST | Regle |
| --- | --- |
| `messageId` | String non blanche, 1–128 unites UTF-16, sensible a la casse, conservee sans transformation ; whitespace-only refuse. |
| `text` | String non blanche, 1–4000 unites UTF-16 ; trim utilise uniquement pour verifier le vide, ne jamais reecrire le texte. |

Le comptage repose sur `.length` JavaScript (unites UTF-16), documente dans le schema/guide. `@MaxLength` de class-validator/validator et `maxLength` OpenAPI ne mesurent pas les unites UTF-16 comme `.length` : ne pas les utiliser seuls pour appliquer cette limite. Ajouter un validateur explicite `.length`, documenter `x-maxUtf16Length`/la description du schema et tester les emojis, caracteres BMP et paires surrogate. En 6.1 `imageUrl` est un champ inconnu refuse ; 6.2 l'ajoutera. Ne pas accepter `groupId`, `targetId`, `source`, `scheduledAt`, `templateType`, ou une URL arbitraire de service. Une nouvelle cle de message ne permet que la cible configuree.

```json
{ "messageId": "hermes-news-2026-10-12-001", "text": "Conseil du soir : Dune.\nBon film !" }
```

Reponse premiere creation HTTP202 :

```json
{
  "jobId": "cjob-example",
  "messageId": "hermes-news-2026-10-12-001",
  "status": "pending",
  "deduplicated": false,
  "requestId": "uuid-de-cet-appel"
}
```

Repetition identique : HTTP200, meme jobId, statut actuel et deduplicated=true. Une repetition ne programme pas automatiquement une relance d'un job sent/failed. Pour une nouvelle publication intentionnelle, Hermes doit fournir un nouveau messageId.

```json
{ "error": { "code": "AGENT_MESSAGE_ID_CONFLICT", "message": "Cet identifiant correspond deja a un autre message.", "requestId": "uuid-de-cet-appel" } }
```

Erreurs metier : HTTP400 `AGENT_INVALID_REQUEST`, HTTP409 `WHATSAPP_GROUP_NOT_SELECTED`, HTTP409 `AGENT_MESSAGE_ID_CONFLICT`. Une panne interne non metier retourne HTTP500 `AGENT_INTERNAL_ERROR`, sans SQL, chemins runtime, stack ni secret. L'UUID de correlation est genere par Whatsarr pour chaque appel ; ne pas faire confiance a un header client non valide. POST/erreurs exposent le requestId courant, `job.requestId` conserve celui de la creation initiale pour les logs et le futur GET6.3.

Le ValidationPipe global ne suffit pas a garantir une racine objet : ajouter un pipe agent explicite avant validation des proprietes. Un JSON syntaxiquement malforme retourne egalement HTTP400 `AGENT_INVALID_REQUEST` avec requestId. Le parseur de corps peut echouer avant le controller : installer une gestion path-aware au bootstrap pour ces erreurs sur `/api/agent`, avec correlation disponible avant parsing ; hors de ce prefixe, conserver la gestion legacy. Couvrir `{`, `null`, `[]`, nombres, strings et booleens dans les tests HTTP reels.

### Stockage et anti-doublon

Payload a enregistrer des 6.1, compatible avec l'extension photo6.2 :

```json
{
  "kind": "agent_message",
  "source": "hermes",
  "messageId": "hermes-news-2026-10-12-001",
  "text": "Conseil du soir : Dune.\nBon film !",
  "mediaUrl": null
}
```

`type=agent_message`, `targetType=group`, `targetId` pris depuis la ligne WhatsAppServerGroup id=server. La cle est `job:agent:hermes:<messageId>` : elle n'inclut ni contenu, ni groupe, ni requestId. Un hash du texte dans la cle supprimerait la detection de conflit ; inclure le groupe republierait un message apres changement de groupe.

La comparaison utilise uniquement le texte exact et mediaUrl (null ici), avec kind/source/messageId valides. Ne pas comparer JSON brut sensible a l'ordre des proprietes. La deduplication n'est pas une garantie de livraison exactement une fois lors d'un crash apres acceptation par WhatsApp et avant ecriture du statut : conserver la prudence actuelle sur ces jobs processing, ne pas les remettre aveuglement pending. Ne pas inventer une garantie de livraison distribuee.

Flux recommande : validation -> lookup unique -> si existe comparer et retourner -> sinon resoudre groupe -> create -> en cas de P2002 lire ligne existante et comparer -> retourner resultat. Un P2002 sur une autre contrainte ou une panne ne doit pas devenir un faux doublon. Si SQLite remonte un verrou temporaire, utiliser une strategie bornee et tester la concurrence reelle ; pas de boucle infinie ni cache memoire d'anti-doublon.

### Etat reel des fichiers existants et impact

| Fichier | Etat actuel | Changement / preservation |
| --- | --- | --- |
| `apps/api/src/app.module.ts` | Importe modules settings, WhatsApp, notifications, media, recap ; pas d'AgentModule. | Ajouter AgentModule sans retirer les modules existants. |
| `apps/api/src/main.ts` | Prefixe api, cookies, CORS UI et ValidationPipe global whitelist+forbidNonWhitelisted+transform ; pas d'OpenAPI. | Preserver bootstrap/CORS ; le module agent gere filtre/doc sans changer les erreurs de toutes les routes. |
| `apps/api/src/modules/notifications/notifications.types.ts` | Quatre types metier, payload uniquement templateType/variables/mediaUrl. | Ajouter type/payload agent ; preserver compatibilite des quatre createurs legacy. |
| `apps/api/src/modules/notifications/notifications.service.ts` | findUnique puis create non atomique ; rendu toujours par template ; max3 essais ; intervalle15s ; lot10 ; erreurs par job isolees. | Ajouter creation Hermes robuste et branche texte ; preserver toutes ces regles et erreurs post-send hors retry. |
| `apps/api/src/modules/notifications/notifications.service.spec.ts` | Mocks prisma en memoire, huit tests dont erreur logs et reset du retry manuel. | Garder tests ; enrichir mocks et ajouter de vrais tests SQLite pour unicite, pas uniquement un mock qui promet l'unicite. |
| `apps/api/src/modules/notifications/notifications.module.ts` | Exporte NotificationsService, importe WhatsAppModule et TemplatesModule. | Reutiliser l'export ; pas de seconde file ni worker. |
| `apps/api/src/modules/whatsapp/whatsapp.service.ts` | requireServerGroup lit id=server et leve actuellement BadRequestException si absent. | Reutiliser la resolution, mapper en409 pour route agent seulement ; ne pas changer globalement ses erreurs legacy. |
| `apps/api/src/modules/auth/auth.guard.ts` et `auth.service.ts` | Protection par controller, bypass si AUTH_DISABLED n'est pas false. | Lire/reutiliser pour tests ; aucune mutation de l'auth n'est necessaire. |
| `apps/api/prisma/schema.prisma` et `modules/database/prisma.service.ts` | dedupe_key unique et type/payload TEXT ; schema runtime cree en SQL au bootstrap. | Aucun nouveau champ requis ; pas de migration pour un nouveau type string. Si une vraie evolution est necessaire, synchroniser migration et ensureSchema, justifier. |
| `packages/shared/src/index.ts` | PublicNotificationJob type:string, payload:unknown ; MessageTemplateType a quatre valeurs. | Ajouter DTO/public types utiles sans imposer agent_message a MessageTemplateType ni changer payload legacy. |

Les fichiers existants sont lus, pas modifies par la preparation de story. Les controllers ne parlent pas directement a Prisma ni a l'adapter : services metier encapsulent ces acces. Preferer une methode claire pour l'enqueue agent a une modification destructive de la signature createJob utilisee ailleurs.

### Project Structure Notes

NEW : `apps/api/src/modules/agent/agent.module.ts`, `agent.controller.ts`, `agent.service.ts`, `agent.dto.ts`, `agent.types.ts`, `agent-exception.filter.ts`, `agent.controller.spec.ts`, `agent.service.spec.ts`, `agent.integration.spec.ts`, `docs/hermes-agent.md`, `docs/hermes-agent.openapi.json`.
UPDATE : AppModule, notifications types/service/spec, shared public types si necessaire. Les autres fichiers de la table sont points de reuse/read-only sauf justification explicite. Ne pas creer `apps/api/src/modules/jobs` en parallele du worker deja dans NotificationsService.

L'API Nest CommonJS n'a pas actuellement de dependance `@whatsarr/shared` declaree ; le package shared est ESM. Ne pas ajouter un import runtime ESM dans l'API CJS par commodite. Les DTO Nest peuvent rester dans agent ; les types frontend utilisent shared, ou un type-only dont la resolution est explicitement configuree et validee au build.

### Bibliotheques et documentation verifiee

Versions locales observees le2026-10-12 : NestJS11.1.21, Prisma Client6.19.3, class-validator0.14.4, Vitest3.2.4, TypeScript5.9.3, whatsapp-web.js1.34.7. Ce sont les versions installees, pas une assertion sur les dernieres versions disponibles. Respecter les declarations et le lockfile du repo ; aucune mise a niveau generale ne fait partie de cette story.

Prisma6 documente les conflits uniques lors de creations/upserts concurrents et leur traitement P2002 ; c'est la raison de la relecture du gagnant ci-dessus. [Reference officielle Prisma6](https://docs.prisma.io/docs/orm/v6/reference/prisma-client-reference#upsert).

La validation Nest s'appuie sur les classes DTO et ValidationPipe deja present ; les erreurs agent doivent etre mappees sans changer la forme attendue par l'UI existante. [Validation NestJS](https://docs.nestjs.com/techniques/validation), [filtres d'exceptions NestJS](https://docs.nestjs.com/exception-filters).

OpenAPI peut etre un document statique JSON pour cette facade ; `@nestjs/swagger` n'est pas installe. Emballer le schema dans le module et tester GET en build de production plutot qu'ajouter une dependance necessaire seulement pour servir un objet JSON.

### Strategie de tests et definition de termine

- Unitaires : validation/creation, conflit, texte litteral, event metadata, worker5 types, erreur logs, retry.
- Integration Nest HTTP : utiliser `@nestjs/testing` existant, fetch ou client de test ; executer le vrai pipe/filtres, pas une methode de controller isolee.
- Integration DB : creer SQLite temporaire avec schema reel compatible, detruire clients/fichiers apres tests. Ne pas utiliser `/data` production ni demarrer un vrai navigateur WhatsApp.
- Tests integration a placer sous `src/**/*.spec.ts`, car vitest.config.ts n'inclut actuellement que ce motif ; `apps/api/test/e2e` ne serait pas execute sans adaptation explicite.
- Cas concurrence :10 requetes identiques ->1 row,1 creation202 et9 repetitions200 ;10 requetes de deux contenus differents ->1 row gagnant, conflits409 pour l'autre contenu.
- Cas persistance : ferme/rerouvre le client avant replay ; retrouve exactement le job initial et son groupe.
- Cas crash incertain : verifier pas de reprise automatique aveugle des processing apres envoi, sans promettre exactement-once.
- Verification cible : `pnpm --filter @whatsarr/api test`, `pnpm --filter @whatsarr/api lint`, `pnpm build`. Les tests doivent passer avant de marquer review ; enregistrer les commandes reelles.
- Baseline de ce chat :56 tests API passent apres les corrections precedentes, sans preuve de test reel Plex/WhatsApp. Ces modifications locales doivent etre preservees.

### Previous Story Intelligence / Git Intelligence

Pas de story precedente dans l'epic6. Historique pertinent : `d72d82a` corrige la fenetre recente des notifications de demande ; `e5d5d5f` introduit le scope bibliotheques ; `89e7154` traite la deduplication cross-source. Ne pas reutiliser MediaService.routeAvailability pour un message editorial Hermes : cela reappliquerait des regles de disponibilite et fenetre recentes hors perimetre.

Les corrections locales du worker separent maintenant le send des ecritures post-send et traitent une erreur par job sans arreter le lot. Ce sont des comportements a conserver, meme non encore commites.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic6, Story6.1 et FR21–FR24]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Data Architecture ; API & Communication Patterns ; Job/Outbox Patterns ; Architectural Boundaries]
- [Source: `apps/api/src/modules/notifications/notifications.service.ts` — createJob, processDueJobs, processJob, sanitize]
- [Source: `apps/api/src/modules/notifications/notifications.types.ts` — NotificationPayload et CreateNotificationJobInput]
- [Source: `apps/api/prisma/schema.prisma` — NotificationJob]
- [Source: `apps/api/src/modules/database/prisma.service.ts` — ensureSchema]
- [Source: `apps/api/src/modules/whatsapp/whatsapp.service.ts` — requireServerGroup]
- [Source: `apps/api/src/main.ts` ; `app.module.ts` ; `apps/api/vitest.config.ts`]
- [Source: `packages/shared/src/index.ts` ; `apps/api/package.json`]
- Pas de project-context.md ni document UX autonome trouve ; les besoins UX existants sont dans epics.md.

## Story Completion Status

Implementation complete, prete pour revue. Les taches sont cochees et le contexte de preparation ci-dessus reste conserve comme reference historique.

## Dev Agent Record

### Agent Model Used

Codex — implementation BMAD sequentielle.

### Debug Log References

88 tests API passes ; lint TypeScript API passe ; builds API/shared/web passes via pnpm 9.15.0 direct (wrapper pnpm/Turbo incompatible avec dependances locales). Prisma genere depuis le schema existant. HTTP et SQLite reel testes.

### Completion Notes List

- POST texte local sans cle, validation stricte UTF16 et JSON malforme, erreurs correlees sans secrets.
- Creation atomique P2002 : concurrence identique/conflictuelle, replay apres reconnexion DB, groupe epingle et logs indisponibles testes.
- Worker texte brut ; quatre templates historiques preserves, retries limites et absence de reprise aveugle processing.
- OpenAPI embarque dans le build et guide local livrés.

- Les tests automatiques utilisent une base SQLite temporaire et des services controles ; aucune publication de test vers le groupe reel.
- Aucun smoke test avec Plex/Tautulli/WhatsApp reel effectue ; verification en conditions locales reelles a faire avec l'administrateur.

### File List

- `_bmad-output/implementation-artifacts/6-1-envoyer-un-texte-hermes-au-groupe-whatsapp.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/modules/agent/agent.types.ts`
- `apps/api/src/modules/agent/agent.dto.ts`
- `apps/api/src/modules/agent/agent.dto.spec.ts`
- `apps/api/src/modules/agent/agent.controller.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/agent/agent.module.ts`
- `apps/api/src/modules/agent/agent-exception.filter.ts`
- `apps/api/src/modules/agent/hermes-openapi.ts`
- `apps/api/src/modules/agent/agent.integration.spec.ts`
- `apps/api/src/modules/notifications/notifications.types.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/notifications/notifications.service.spec.ts`
- `apps/api/src/modules/notifications/notifications.controller.ts`
- `docs/hermes-agent.openapi.json`
- `docs/hermes-agent.md`

## Change Log

- 2026-10-12 : implementation et verification story 6.1, prete pour revue.
