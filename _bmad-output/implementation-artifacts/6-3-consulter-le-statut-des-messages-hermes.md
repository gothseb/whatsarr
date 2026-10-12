# Story 6.3 : Consulter le statut des messages Hermes

Status: review

Story Key: `6-3-consulter-le-statut-des-messages-hermes`
Date de préparation : 2026-10-12

## Story

En tant qu'administrateur utilisant Hermes,
je veux suivre les messages soumis par mon agent et les retrouver dans les logs,
afin de savoir s'ils sont en attente, envoyés ou en erreur et de corréler les opérations.

## Contexte et dépendances

- Epic 6 ; exigences FR21, FR28, NFR2, NFR3, NFR5 et UX-DR8.
- Dépend de la soumission persistante et dédupliquée de 6.1 ; traiter aussi le payload photo de 6.2 lorsqu'il est livré.
- Ces stories sont documentées, pas implémentées au moment de la préparation ; aucun endpoint agent n'existe actuellement.
- La projection de statut fonctionne pour les messages texte ; la présence d'une photo ne modifie pas son schéma.
- Réutiliser NotificationJob, OperationalLog, les listes administrateur et la page Messages existante.
- L'API Hermes demeure sans clé, cookie ou authentification, même avec `AUTH_DISABLED=false`.
- Les routes admin jobs/logs/process/retry restent protégées par leur AuthGuard actuel.
- Aucun nouvel écran de configuration de clé, aucune seconde file, aucun calcul de statut déduit de WhatsApp.

## Acceptance Criteria

### AC1 — Lire l'état persistant d'un job Hermes

**Given** un job accepté par 6.1 ou 6.2,
**When** Hermes appelle `GET /api/agent/messages/:jobId` sans clé ni cookie,
**Then** HTTP 200 retourne `{ jobId, messageId, source: "hermes", status, attempts, createdAt, sentAt, failedAt, lastError, requestId }`.
**And** les dates sont ISO 8601 UTC, les champs indisponibles sont `null` et `attempts` est entier.
**And** `requestId` est celui de la première acceptation persistée, pour corréler la soumission au worker.

### AC2 — Conserver les cinq statuts réels

**Given** le job est `pending`, `processing`, `retry_scheduled`, `sent` ou `failed`,
**When** son statut est demandé,
**Then** la valeur exacte persistée est retournée, sans fusionner les états ou annoncer un envoi prématuré.
**And** `sent` signifie que le transport WhatsApp a accepté l'envoi, pas qu'un membre l'a lu.
**And** une erreur de log après succès ne remplace pas `sent` par un état provoquant le renvoi.

### AC3 — Restreindre la consultation à Hermes

**Given** un identifiant absent ou un job appartenant à une autre source,
**When** Hermes le consulte,
**Then** HTTP 404 retourne `AGENT_MESSAGE_NOT_FOUND` dans l'enveloppe d'erreur agent.
**And** une ligne seulement étiquetée `agent_message` avec payload corrompu/source différente ne passe pas pour Hermes.
**And** aucune réponse n'expose payload brut, texte intégral, URL image, clé de déduplication, cible, secrets ou session WhatsApp.

### AC4 — Identifier les messages et événements dans l'existant

**Given** un message est accepté, dédupliqué, envoyé, reprogrammé ou échoué,
**When** l'administrateur ouvre Messages et les logs existants,
**Then** la source Hermes, le `jobId`, le `messageId` et les `requestId` utiles sont visibles.
**And** la page continue d'afficher les notifications legacy et de proposer leur relance manuelle après échec.
**And** les listes conservent leur forme tableau existante, leurs limites et leur protection admin.

### AC5 — Confidentialité des projections et logs

**Given** une erreur contient une URL avec query sensible ou un secret,
**When** l'état, les listes ou les logs sont projetés,
**Then** `lastError` et le contexte affiché sont nettoyés avec un message exploitable.
**And** aucune URL authentifiée ni contenu média brut n'apparaît dans les logs ou la projection publique Hermes.
**And** aucun stacktrace brut n'est rendu ; l'identifiant de corrélation reste utilisable.

### AC6 — Persistance et lecture seule

**Given** un changement de statut, une relance admin ou un redémarrage,
**When** Hermes consulte à nouveau le job,
**Then** la réponse reflète l'état courant en base et les mêmes identifiants métier.
**And** le GET ne déclenche ni envoi, ni création de job, ni reset de retries ou modification des timestamps.
**And** la lecture ne dépend ni d'une session WhatsApp connectée, ni de Plex/Tautulli disponibles.

### AC7 — Contrat et vérification de bout en bout

**Given** cette fonctionnalité est livrée,
**When** les tests et les exemples OpenAPI sont examinés,
**Then** les cinq états, jobs absents/non-Hermes/corrompus, masquage et listes mixtes sont couverts.
**And** le guide explique l'enchaînement POST accepté → GET du job, la déduplication et les erreurs.
**And** les routes admin restent protégées quand l'API agent est accessible sans cookie.

## Tasks / Subtasks

- [x] 1. Définir une projection de statut dédiée (AC1, AC2, AC3, AC5).
  - [x] 1.1 Ajouter le contrat partagé `AgentMessageStatus` et l'union des cinq statuts sans changer les types legacy en chaîne ouverte.
  - [x] 1.2 Réutiliser le discriminant strict du payload agent fourni par 6.1 ; extraire uniquement `messageId` et `source`.
  - [x] 1.3 Mapper les dates, valeurs nulles et `lastError` nettoyée ; retourner une liste explicite de champs autorisés.
  - [x] 1.4 Vérifier type `agent_message`, kind `agent_message`, source `hermes` et identifiant métier valide.
- [x] 2. Ajouter le GET local sans authentification (AC1, AC3, AC6, AC7).
  - [x] 2.1 Ajouter `@Get("messages/:jobId")` au contrôleur agent convenu en 6.1.
  - [x] 2.2 Chercher par clé primaire Prisma avec sélection bornée, puis filtrer source/type avant projection.
  - [x] 2.3 Retourner HTTP 404 stable pour absence/non-Hermes/corruption ; ne jamais déléguer à la route admin listJobs.
  - [x] 2.4 Réutiliser le filtre d'erreur et corrélation agent local de 6.1 sans modifier les erreurs admin existantes.
- [x] 3. Étendre les métadonnées des listes jobs et logs (AC4, AC5, AC6).
  - [x] 3.1 Ajouter `source` et `messageId` optionnels/nullables aux projections job administrateur.
  - [x] 3.2 Rendre la projection payload Hermes nettoyée ; ne pas renvoyer imageUrl et paramètres sensibles non nécessaires.
  - [x] 3.3 Ajouter source/messageId/jobId au contexte des événements existants pour Hermes.
  - [x] 3.4 À la déduplication, loguer le requestId courant avec contexte `originRequestId` de première acceptation.
  - [x] 3.5 Aux événements worker, garder le requestId original ; ne jamais réécrire le champ du job au GET ou doublon POST.
- [x] 4. Améliorer la page Messages existante (AC4, AC5, AC7).
  - [x] 4.1 Ajouter libellé Hermes et identifiants lisibles dans les lignes Outbox, avec fallback pour jobs legacy.
  - [x] 4.2 Afficher contexte de corrélation autorisé dans Logs sans sérialiser l'objet context complet.
  - [x] 4.3 Préserver Rafraîchir, Traiter, Relancer, loading/error/busy et chemins API admin avec credentials.
  - [x] 4.4 Ne pas ajouter de formulaire token, nouvelle navigation ou polling rapide ; GET agent sert à Hermes.
- [x] 5. Vérifier et documenter les contrats (AC1 à AC7).
  - [x] 5.1 Ajouter tests unitaires de projection/service et HTTP du contrôleur agent.
  - [x] 5.2 Ajouter scénario Prisma SQLite acceptation → redémarrage → statut et statuts persistants successifs.
  - [x] 5.3 Vérifier UI avec jeux de jobs/logs mixtes, identifiants longs et erreurs masquées.
  - [x] 5.4 Étendre OpenAPI statique et guide Hermes, puis exécuter tests API, lint et build.

## Dev Notes

### Contrat HTTP

```http
GET /api/agent/messages/cm_example
```

```json
{
  "jobId": "cm_example",
  "messageId": "conseil-2026-10-12-dune",
  "source": "hermes",
  "status": "retry_scheduled",
  "attempts": 1,
  "createdAt": "2026-10-12T08:00:00.000Z",
  "sentAt": null,
  "failedAt": null,
  "lastError": "AGENT_IMAGE_TIMEOUT : téléchargement image expiré.",
  "requestId": "req-first-post"
}
```

Réponse absence/non-Hermes : HTTP 404.

```json
{
  "error": {
    "code": "AGENT_MESSAGE_NOT_FOUND",
    "message": "Message Hermes introuvable.",
    "requestId": "req-current-get"
  }
}
```

Ne pas ajouter `payload`, `targetId`, `dedupeKey`, `mediaUrl` ou stacktrace au succès agent.
Les valeurs nulles ne sont pas remplacées par une date fictive ou une chaîne vide.
`jobId` est l'id Prisma reçu au POST, pas `messageId` ; ne pas rechercher par clé de déduplication depuis ce GET.
Pour un paramètre de route non vide inconnu, renvoyer 404 sans imposer une expression régulière CUID fragile.

### État, identité et corrélation

| Statut | Sens | Timestamps attendus |
| --- | --- | --- |
| `pending` | Accepté ou relancé manuellement | createdAt présent, champs indisponibles null |
| `processing` | Tentative démarrée, incrément attempts effectué | Ne pas inventer sentAt |
| `retry_scheduled` | Tentative échouée, nouvelle tentative prévue | lastError disponible, failedAt normalement null |
| `sent` | Transport accepté et succès persisté | sentAt présent, failedAt/lastError nettoyés |
| `failed` | Budget automatique épuisé | failedAt et lastError présents |

Retourner les champs persistés : aucune réécriture de timestamps au GET pour forcer la cohérence de ce tableau.
Une relance manuelle remet actuellement attempts à zéro, failedAt et lastError à null ; elle conserve id et requestId.
La story 6.1 choisit `job:agent:hermes:${messageId}` et payload `{ kind, source, messageId, text, mediaUrl }`.
Ne pas réinterpréter une notification template avec `variables.source` comme un message Hermes.
Le premier POST stocke requestId origine ; les répétitions POST répondent avec leur propre requestId mais ne modifient pas la ligne.
Le GET succès expose origine ; son éventuel header de corrélation et ses erreurs concernent la requête GET courante.
Exemple déduplication : contexte `{ source: "hermes", jobId, messageId, originRequestId }`, log.requestId = requête répétée.
Exemple worker : même contexte métier, log.requestId = requestId origine de la ligne.
Ne pas promettre une sémantique « exactly once » du transport après crash entre acceptation WhatsApp et persistance.
Un job laissé `processing` après crash doit être montré tel quel ; ne pas introduire récupération/re-envoi implicite dans cette lecture.

### Project Structure Notes : UPDATE et NEW

| Chemin / opération | État actuel | Changement attendu | À préserver |
| --- | --- | --- | --- |
| `apps/api/src/modules/agent/agent.controller.ts` — UPDATE après 6.1 | Absent ; POST et OpenAPI prévus en 6.1 | Ajouter GET messages/:jobId | Absence guard sur agent, filtre d'erreurs agent seulement |
| `apps/api/src/modules/agent/agent.service.ts` — UPDATE après 6.1 | Absent ; service soumission prévu | Lecture projetée dédiée | Déduplication, groupe épinglé et requestId immuable |
| `apps/api/src/modules/agent/agent.service.spec.ts` — UPDATE après 6.1 | Tests à créer en 6.1 | Étendre cinq états, absent/source/malformed | Cas conflits/concurrence de 6.1 |
| `apps/api/src/modules/agent/agent.controller.spec.ts` — UPDATE après 6.1 | Tests HTTP à créer en 6.1 | Ajouter GET et auth agent/admin | POST 202/200/400/409 et formats legacy |
| `apps/api/src/modules/notifications/notifications.service.ts` — UPDATE | listJobs retourne tableau et payload brut ; listLogs nettoie context ; worker persiste états | Enrichir toPublicJob et logs Hermes ; nettoyer projection agent | Forme tableau, limite jobs100/logs200, retry et chemin templates |
| `apps/api/src/modules/notifications/notifications.service.spec.ts` — UPDATE | Tests mocks déduplication, retries et erreur de log post-sent | Assertions context/id/public lists/nettoyage | Continuation batch et trois tentatives |
| `packages/shared/src/index.ts` — UPDATE | PublicNotificationJob expose type/status strings, payload unknown ; PublicOperationalLog context unknown | Ajouter AgentMessageStatus et champs metadata job optionnels | Tous exports, compatibilité utilisateurs/dashboard/API |
| `apps/web/src/App.tsx` — UPDATE | MessagesPage affiche type/cible/statut, erreur, date ; Logs affiche event/reason/message/requestId | Libellé Hermes, jobId/messageId/originRequestId ciblés | États de chargement, refresh/process/retry et écrans autres |
| `docs/hermes-agent.openapi.json`, `docs/hermes-agent.md` — UPDATE après 6.1 | Fichiers prévus en 6.1 | Ajouter schéma GET et workflow suivi | Routes lecture média et contrats POST |
| `apps/api/src/modules/agent/agent-status.integration.spec.ts` — NEW | Aucun test persistance agent | Scénario Prisma SQLite réel sur DB temporaire | Aucune connexion aux services réels |

`apps/web/src/api.ts` a été lu : il fournit déjà listNotificationJobs/listOperationalLogs/retry/process avec credentials.
Il n'a pas besoin de modification si la projection partagée reste compatible ; conserver le helper d'erreur admin `{message}`.
`notifications.controller.ts` a été lu : AuthGuard sur la classe, liste tableau et retry admin ; conserver ces routes sans les copier.
`schema.prisma` fournit déjà status, attempts, requestId, dates et payloadJson ; aucune migration nécessaire pour un GET projeté.
Le package shared est ESM et l'API Nest est CommonJS sans dépendance shared déclarée : pas d'import runtime shared dans l'API ; utiliser ses types locaux agent ou type-only avec résolution/build vérifiés.
`status.service.ts` consomme listJobs : les métadonnées nouvelles doivent être additives et ne pas casser le dashboard/SSE.
L'architecture propose des dossiers pages/TanStack Query ; le code réel utilise App.tsx et useState : étendre le code réel sans migration UI.

### Sanitisation et confidentialité

Le sanitizer actuel masque des clés communes dans query et certaines chaînes longues, mais ne couvre pas toute query signée.
Pour les messages Hermes, ne pas loguer l'URL image complète ; retirer au minimum query et fragment avant projection si une référence est nécessaire.
Nettoyer l'erreur du downloader avant persistance ; re-nettoyer au GET protège aussi des lignes préexistantes polluées.
Ne pas retourner `toPublicJob` tel quel depuis GET agent : il contient payload, targetId et dedupeKey.
Projection job admin : conserver l'enveloppe legacy mais fournir un payload Hermes nettoyé sans URL sensible ; le worker lit toujours payloadJson d'origine.
Une ligne corrompue doit produire une erreur observable dans logs admin, jamais exposer son JSON au GET Hermes.
L'UI rend les identifiants comme texte React ; pas de HTML interprété et pas de JSON context arbitraire.

### Testing Requirements

| Niveau | Scénario | Assertion principale |
| --- | --- | --- |
| Service | Les cinq statuts persistés | Valeurs exactes, dates ISO, nulls conservés |
| Service | attempts 0/1/3, relance | Compteur lu sans mutation ; zéro après retry admin |
| Service | job absent/template/autre source | Même HTTP404/code, aucune donnée du job |
| Service | payload JSON invalide ou kind/source manquant | Pas d'exception JSON brute ni fuite |
| Service | URL signée/API key dans lastError | Secret absent de statut/listes/logs |
| HTTP | AUTH_DISABLED=false, sans cookie | GET agent accessible, endpoints admin refusés |
| HTTP | Première soumission puis doublon et GET | GET requestId origine, erreur GET requestId courant |
| SQLite réel | Redémarrage nouveau service même base | Même job, identifiants et état persisté |
| Worker | Succès puis échec de log | sent lisible, aucun nouveau job ou renvoi |
| UI | Jobs/logs Hermes et legacy mélangés | Source/id lisibles, anciens rendus et relance utilisables |
| Contrat | Document OpenAPI et JSON exemples | Schéma statuts/nulls et réponses conformes |

Utiliser Vitest co-localisé et fixtures déterministes ; la DB d'intégration est temporaire et isolée de la DB utilisateur.
Les mocks actuels findUnique cherchent seulement dedupeKey : les adapter pour lookup id afin d'éviter un faux test positif.
Aucun appel WhatsApp ne doit être déclenché par un test GET ; vérifier explicitement les spies sendMessage/sendMedia et create.
Vérification UI via rendu/test déjà disponible ou contrôle manuel documenté ; ne pas introduire un framework lourd pour cette petite extension.

```sh
pnpm --filter @whatsarr/api test
pnpm lint
pnpm build
```

### Intelligence précédente et technique

NotificationsService marque sent avant de loguer le succès et continue le batch si un log échoue ; préserver cette séparation.
RetryJob remet le compteur à zéro : un statut affiché ne doit pas cacher cette action en prétendant conserver trois tentatives.
Le code partage déjà PublicNotificationJob avec les listes et dashboard, ce qui justifie des métadonnées additives.
Version verrouillée whatsapp-web.js 1.34.7 ; aucun changement de bibliothèque ou client média pour cette story.
La spécification OpenAPI statique `docs/hermes-agent.openapi.json` servie par GET /api/agent/openapi.json est prévue en 6.1.
Ne pas ajouter @nestjs/swagger sans besoin : il n'est pas installé et la documentation peut utiliser le fichier convenu.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` # Epic 6 / Story 6.3 / UX-DR8]
- [Source: `_bmad-output/planning-artifacts/architecture.md` # Format Patterns / Logging Patterns / Process Patterns]
- [Source: `apps/api/src/modules/notifications/notifications.service.ts` # toPublicJob / listJobs / listLogs / retryJob / processJob]
- [Source: `apps/api/src/modules/notifications/notifications.controller.ts` # AuthGuard / jobs / logs]
- [Source: `packages/shared/src/index.ts` # PublicNotificationJob / PublicOperationalLog / PublicAppLiveStatus]
- [Source: `apps/web/src/App.tsx` # MessagesPage / DashboardPage ; `apps/web/src/api.ts` # request / listNotificationJobs]
- [Source: `apps/api/prisma/schema.prisma` # NotificationJob / OperationalLog]

## Préparation de la story

Contexte préparé le 12 octobre 2026 avec BMAD create-story, checklist, epic et fichiers réels pertinents.
Les dépendances futures sont décrites comme contrats ; aucune réalisation précédente ni validation de tests n'est revendiquée.

## Dev Agent Record

### Agent Model Used

Codex — implementation BMAD sequentielle.

### Debug Log References

119 tests API et 3 tests UI SSR passent ; lint API/web et builds API/shared/web passent. Statuts successifs et reconnexion SQLite testes ; rendu Hermes/legacy avec identifiants longs et contexte sensible verifies.

### Completion Notes List

- GET projete en lecture seule, cinq statuts, origine requestId, 404 uniforme absent/non-Hermes/corrompu.
- Metadonnees jobs/logs additives ; URLs sensibles et stack multiline nettoyes ; payload Hermes admin limite aux identifiants.
- Page Messages conserve actions et rendu legacy, ajoute source et correlation ciblee ; tests SSR et build UI passes.

- Les tests automatiques utilisent une base SQLite temporaire et des services controles ; aucune publication de test vers le groupe reel.
- Aucun smoke test avec Plex/Tautulli/WhatsApp reel effectue ; verification en conditions locales reelles a faire avec l'administrateur.

### File List

- `_bmad-output/implementation-artifacts/6-3-consulter-le-statut-des-messages-hermes.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/agent/agent.controller.ts`
- `apps/api/src/modules/agent/agent.integration.spec.ts`
- `apps/api/src/modules/agent/hermes-openapi.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- `packages/shared/src/index.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/components/MessageIdentity.tsx`
- `apps/web/src/components/MessageIdentity.spec.tsx`
- `docs/hermes-agent.openapi.json`
- `docs/hermes-agent.md`

## Change Log

- 2026-10-12 : implementation et verification story 6.3, prete pour revue.
