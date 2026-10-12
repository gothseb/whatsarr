# Story 6.5: Consulter les derniers ajouts Plex

Status: review

## Story

En tant qu'administrateur utilisant Hermes,
je veux que l'agent consulte les contenus récemment ajoutés à Plex,
afin qu'il prépare les news du groupe sur les nouvelles disponibilités du serveur.

**Story key :** `6-5-consulter-les-derniers-ajouts-plex`.
**Couverture :** FR21, FR26, NFR3, NFR5, NFR6, NFR8, NFR9.
**Prérequis :** 6.1 pour la façade agent ; 6.4 pour le client/normaliseur et pagination Plex.
**Indépendance :** aucune dépendance à 6.6 ; lectures disponibles sans groupe/session WhatsApp.

## Acceptance Criteria

1. **Consultation locale sans clé.** Étant donné Plex configuré, quand Hermes appelle `GET /api/agent/media/recent`, alors HTTP 200 renvoie `{ items, pagination: { offset, limit, hasMore }, source:"plex" }` sans clé/cookie Hermes, même quand l'authentification admin est active.
2. **Filtres.** `libraryKey` et `mediaType=movie|series|episode` sont facultatifs. La pagination reprend les limites de 6.4 et s'applique après filtres et déduplication `(libraryKey,ratingKey)`.
3. **Tri global.** Tous les résultats sont triés par `addedAt` décroissant avant découpage, avec départage stable `libraryKey`, `ratingKey`. Le tri vaut pour plusieurs bibliothèques, pas seulement à l'intérieur de chacune.
4. **Sémantique d'ajout.** Un ancien film ajouté aujourd'hui figure dans les nouveautés à sa date d'ajout. La date de sortie n'est pas substituée à `addedAt` ; le filtre de six mois des annonces automatiques ne s'applique jamais à cette route.
5. **Métadonnées et épisodes.** Le schéma de base reprend 6.4, complété par `releaseDate`, `seriesTitle`, `seasonNumber`, `episodeNumber`. Pour un épisode ces champs suivent Plex quand disponibles ; absents = `null`. Aucun contenu ni numéro n'est inventé.
6. **Absence et confidentialité.** Aucun ajout disponible produit 200 avec liste vide et `hasMore:false`. Les champs facultatifs manquants restent explicites. Aucun token, chemin de fichier vidéo ou URL authentifiée ne sort du client.
7. **Erreurs et limites.** Filtres invalides produisent 400 `AGENT_INVALID_REQUEST`, bibliothèque absente 404 `PLEX_LIBRARY_NOT_FOUND`, source non configurée 409 `PLEX_NOT_CONFIGURED`, auth/réseau 502 `PLEX_AUTHENTICATION_ERROR`/`PLEX_UNREACHABLE`, timeout 504 `PLEX_TIMEOUT` après budget 15 secondes.
8. **Lecture seule et compatibilité.** Aucun job ni annonce n'est créé. Les annonces, récap, imports et recherche 6.4 conservent leurs règles. Tests couvrent tri global, égalités, pages suivantes, ancien contenu ajouté et épisodes ; OpenAPI fournit un exemple local sans clé.

## Contrat API à implémenter

```http
GET /api/agent/media/recent?mediaType=episode&libraryKey=2&offset=0&limit=20
```

| Query | Type | Règle |
| --- | --- | --- |
| `libraryKey` | string | facultatif, section connue, non vide |
| `mediaType` | enum | facultatif, movie/series/episode |
| `offset` | integer | défaut 0, entier sûr ≥ 0 |
| `limit` | integer | défaut 20, 1–100 |

```json
{
  "items": [
    {
      "ratingKey": "812",
      "libraryKey": "2",
      "title": "Le signal",
      "mediaType": "episode",
      "year": 2024,
      "summary": null,
      "genres": [],
      "addedAt": "2026-10-11T19:45:00.000Z",
      "releaseDate": "2024-02-20",
      "seriesTitle": "Exploration",
      "seasonNumber": 2,
      "episodeNumber": 3
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "hasMore": false },
  "source": "plex"
}
```

- `releaseDate` reste une date civile `YYYY-MM-DD` quand Plex ne fournit qu'un jour ; ne pas inventer un instant UTC.
- Toutes les dates représentant des instants (`addedAt`) sont ISO UTC.
- Pour films et séries, les champs `seriesTitle`, `seasonNumber`, `episodeNumber` valent `null`.
- `show` Plex devient `series`, `episode` reste `episode`.
- `grandparentTitle` d'un épisode devient `seriesTitle`, `parentIndex` devient saison et `index` épisode.
- `originallyAvailableAt` devient `releaseDate`, distinct de `addedAt`.
- Saison zéro et épisode zéro, s'ils existent réellement, restent 0 et ne deviennent pas null par un test de vérité.
- Les entrées sans `addedAt` exploitable sont placées après les entrées datées ; leur ordre est déterministe.
- Sans filtre `mediaType`, inclure les trois types publics autorisés et exclure saisons/collections/autres catégories.
- Une série est un objet série Plex, pas un épisode arbitrairement remonté/agrégé vers sa série.
- Ne pas dupliquer des séries au titre d'un ajout d'épisode si aucune ligne série n'est fournie par la source.
- Pas de fenêtre « depuis X jours » implicite : c'est une consultation paginée des dates d'ajout connues.
- `hasMore` concerne les contenus publics valides après filtres et déduplication, pas le dernier bloc brut téléchargé.
- Contrat offset sur données vivantes : stabilité à contenu égal, aucune garantie de snapshot entre deux appels.

## Tasks / Subtasks

- [x] 1. Ajouter la route et le DTO recent (AC: 1, 2, 7).
  - [x] Réutiliser le controller/module agent de 6.1 et service lecture de 6.4.
  - [x] Étendre le type autorisé aux épisodes sur cette route seulement.
  - [x] Refuser query inconnue/non scalaire et conserver les erreurs normalisées.
- [x] 2. Étendre le client Plex (AC: 3, 4, 5).
  - [x] Réutiliser settings, sélection de sections et budget d'appels de 6.4.
  - [x] Vérifier les capacités d'énumération et tri `addedAt` des sections installées.
  - [x] Choisir une source donnant de vraies entrées médias, pas seulement un hub/groupement récemment ajouté.
  - [x] Lire les genres/summary/champs épisode présents sans fetch par ligne.
- [x] 3. Implémenter le merge global (AC: 2, 3, 6).
  - [x] Fusionner les flux de bibliothèques/type avec le même ordre ajouté décroissant.
  - [x] Gérer les dates égales et charger la fin d'un bloc d'égalité avant d'arrêter le préfixe.
  - [x] Appliquer déduplication, offset/limit et calcul exact de hasMore.
  - [x] Continuer les pages nécessaires et détecter une pagination Plex ignorée.
  - [x] Respecter limite de mémoire et deadline ; erreur explicite au lieu d'un tri sur un préfixe incomplet.
- [x] 4. Normaliser le schéma étendu (AC: 4, 5, 6).
  - [x] Préserver `releaseDate` comme date civile et `addedAt` comme instant distinct.
  - [x] Définir nullabilité et conversions numériques ; traiter correctement zéros et timestamps invalides.
  - [x] Utiliser une projection sans tokens ni URLs/paths bruts.
- [x] 5. Tester comportements et préservation (AC: 1–8).
  - [x] Ajouter fixtures multi-sections et mélange film/show/episode.
  - [x] Couvrir matrice ci-dessous avec tests HTTP et unitaires.
  - [x] Vérifier recherche 6.4 et absence d'appel MediaService/notifications/TMDB.
- [x] 6. Finaliser le contrat documentaire (AC: 8).
  - [x] Ajouter chemin/schema/exemples dans OpenAPI statique et guide Hermes.
  - [x] Expliquer ajout vs sortie, épisodes/séries, pagination vivante et erreurs.
  - [x] Exécuter tests/lint/build API et consigner le smoke test local si disponible.

## Dev Notes

### État actuel, changement et préservation

| Fichier | État actuel vérifié | Changement | Préservation |
| --- | --- | --- | --- |
| `apps/api/src/modules/plex/plex.service.ts` | comptes/sections, GET timeout 15 s et parsing JSON/XML ; recherche livrable prévu de 6.4 | ajouter lecture recent, mapper episode et fusion globale | imports comptes/sections, erreurs public agent et contrat recherche |
| `apps/api/src/modules/media/media.service.ts` | reçoit événements de disponibilité, enrichit via TMDB, filtre date de sortie et bibliothèques notifications, crée jobs | READ ONLY : ne jamais appeler pour la route recent | routage Overseerr/Plex, filtre recent_window_months, annonces et contacts |
| `apps/api/src/modules/settings/settings.service.ts` | fournit configuration déchiffrée serveur | READ ONLY | aucun nouveau champ/configuration agent |
| `apps/api/src/modules/plex/plex.module.ts` | exporte PlexService | généralement inchangé | providers utilisés par mapping/récap |

### Algorithme recommandé et pièges de pagination

1. Obtenir les sections vidéo éligibles sans appliquer `included`/`notificationIncluded` du récap.
2. Sélectionner les types réellement demandés ; ne pas laisser un index par défaut Plex supprimer tous les épisodes.
3. Quand le serveur permet l'ordre ajouté décroissant, ouvrir des flux paginés bornés par section/type.
4. Fusionner les têtes de flux selon `addedAt DESC, libraryKey ASC, ratingKey ASC`.
5. Pour les dates égales, charger les lignes de l'égalité nécessaires ; ne pas trier seulement la première page Plex.
6. Dédupliquer la paire bibliothèque/identifiant avant de consommer l'offset.
7. Produire `offset + limit + 1` entrées valides ou épuiser tous les flux pour décider `hasMore`.
8. Si le tri amont n'est pas fiable, collecter/ordonner les éléments dans les limites du budget, ou échouer clairement.
9. Une seule bibliothèque en panne fait échouer la route V1 ; pas de liste partielle marquée comme complète.
10. À aucun moment `releaseDate` ne sert de critère d'ordre ou de filtre de nouveautés.

### Recherche technique primaire

- Référence consultée le 12 octobre 2026 : [Plex Media Server API](https://developer.plex.tv/pms/).
- Vérifier les options de tri et pivots exposées par la section et leur fonctionnement sur le serveur installé.
- Le client encapsule les détails Plex ; le contrat public `series` et les limites 20/100 sont propres à Whatsarr.
- Les hubs de nouveautés peuvent regrouper les contenus ; ne pas supposer leur forme équivalente à une liste paginée d'épisodes.
- Rechercher le support réel `addedAt` avant de déléguer tri et filtre ; conserver fixtures des formes constatées.
- Ne pas installer un SDK Plex pour cette extension si les GET/normaliseurs existants suffisent.

### Réutilisation des stories précédentes

- 6.1 apporte route publique locale, filtre d'erreur agent et docs statiques.
- 6.4 apporte sélection de sections, erreurs Plex et normaliseur commun movie/series.
- Étendre la projection sans changer le schéma search à l'insu des consommateurs.
- Les fichiers de contexte 6.1/6.4 sont préparés pour développement ; ils ne constituent pas une preuve d'implémentation terminée.
- Aucun apprentissage de tests/régression de ces stories n'est inventé ; relire leur code réel quand elles seront implémentées.

### Matrice de tests minimale

| Cas | Attendu |
| --- | --- |
| bibliothèque 1 ajout à 10h, bibliothèque 2 à 12h | entrée de bibliothèque 2 en premier |
| dates égales sur deux pages/source et deux sections | départage stable, aucune perte |
| film de 1979 ajouté hier | présent sans filtre de sortie récente |
| même releaseDate mais dates d'ajout différentes | ordre selon ajout |
| épisode série/saison/numéro | mapper les trois métadonnées |
| épisode saison 0/numéro 0 | zéro conservé |
| série Plex show | mediaType series |
| métadonnées/addedAt absents | null explicite, ordre défini |
| filtre episode après page de films | obtenir les épisodes suivants |
| offset au-delà de la fin | 200 vide, hasMore false |
| même ratingKey dans deux sections | deux entrées ; même paire doublonnée = une |
| limit 1/100 et 0/101, type season | accepté/refusé |
| clé absente/auth refusée/timeout | codes de 6.4 |
| page sans progression | erreur explicite, boucle arrêtée |
| auth admin active/WhatsApp absent | recent public local, admin protégé |
| spies notifications/mediaAvailability/TMDB | aucun appel |
| recherche Plex et récap | comportement préservé |

### Project Structure Notes

- UPDATE : `apps/api/src/modules/plex/plex.service.ts`, specs créées en 6.4.
- UPDATE après 6.4 : `apps/api/src/modules/agent/agent.controller.ts`, `agent.service.ts`, `agent-media.dto.ts`, `agent-media.types.ts`.
- UPDATE après 6.1 : `docs/hermes-agent.openapi.json`, `docs/hermes-agent.md`.
- Aucun changement attendu dans `MediaService`, schéma Prisma, frontend ou worker.
- Tout UPDATE agent doit être relu intégralement après développement de 6.4 pour conserver search/messages.

### Cadre transversal Hermes

- Source produit : épic 6 validé par l'utilisateur, FR21 et exigence spécifique ci-dessous.
- API privée locale sans clé, cookie, token Hermes, rôle nouveau ou configuration d'agent.
- Le controller agent ne porte pas `AuthGuard`, même avec `AUTH_DISABLED=false`.
- Les controllers administrateur conservent leur guard : ne pas modifier globalement l'authentification.
- Les credentials Plex/Tautulli restent nécessaires côté serveur et viennent uniquement de `SettingsService`.
- Aucun identifiant de service n'est fourni à Hermes, ni dans les URL, erreurs, exemples ou logs.
- Réutiliser le préfixe global `api` : `@Controller("agent")`, pas `@Controller("api/agent")`.
- DTO NestJS/classes existantes, `class-validator`, transformations explicites des nombres ; pas de nouveau moteur de validation.
- Valeurs répétées dans la query, tableaux, objets, nombres non entiers ou hors safe integer sont refusés.
- Les paramètres inconnus sont refusés ; jamais de proxy générique `url`, `cmd`, `path` ou `apikey`.
- `offset=0`, `limit=20` par défaut ; `offset` entier sûr ≥ 0, `limit` entier de 1 à 100.
- Convertir les chaînes numériques sans accepter `NaN`, `Infinity`, `1.5`, valeurs vides ou coercitions ambiguës.
- Dates ISO 8601 UTC, champs facultatifs présents avec `null` ; collections absentes valent `[]`.
- Générer/corréler un `requestId` par requête via l'infrastructure agent de 6.1.
- Erreurs JSON : `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.
- Réutiliser le filtre d'erreur agent de 6.1 ; conserver les formats legacy hors `/api/agent`.
- Les appels amont ont un budget de 15 secondes incluant téléchargement et parsing ; annuler réellement le fetch.
- Pour un parcours de plusieurs pages, partager une deadline de 15 secondes pour éviter une boucle infinie de timeouts individuels.
- Aucun résultat incomplet ne doit être présenté comme une page complète ou une absence de contenu.
- Contrôler les pages amont et leur progression ; une réponse répétée sans avancement provoque une erreur explicite.
- Ne pas télécharger tout le catalogue/historique en un seul corps ; limiter taille des pages et buffers.
- Projection publique par liste blanche : jamais de propagation `...metadata`, réponse brute ou objet settings.
- Ces lectures ne dépendent ni de la présence d'un groupe ni de la session WhatsApp.
- Pas de job, template, annonce, modification Plex/Tautulli, synchronisation mapping ou enrichissement TMDB déclenché.

### Stack et fichiers de référence réellement présents

- `apps/api/package.json` : NestJS `^11.1.3`, TypeScript `^5.8.3`, Vitest `^3.1.4`.
- Validation déclarée : class-validator `^0.14.2`, class-transformer `^0.5.1`.
- Prisma `^6.8.2` et SQLite sont conservés ; aucune migration n'est requise pour une lecture.
- Ce sont les plages déclarées du dépôt, pas une affirmation de versions résolues ou des versions les plus récentes.
- `fetch` et `AbortSignal.timeout` sont déjà utilisés : conserver ces primitives et le lockfile.
- Les docs d'architecture décrivent certains dossiers projetés ; suivre les chemins existants sous `src/modules`.
- OpenAPI runtime n'est pas installé : étendre `docs/hermes-agent.openapi.json` posé en 6.1.
- Ce fichier statique est exposé par `GET /api/agent/openapi.json` ; aucun besoin de `@nestjs/swagger`.
- Compléter `docs/hermes-agent.md` avec commandes locales et interprétation métier des résultats.
- Les fichiers agent/docs mentionnés ci-dessous sont livrables de 6.1, pas des fichiers déjà implémentés au moment de cette rédaction.

### Validation attendue avant de déclarer la story terminée

```bash
pnpm --filter @whatsarr/api test
pnpm --filter @whatsarr/api lint
pnpm --filter @whatsarr/api build
```

- Tests Vitest co-localisés, fetch/settings contrôlés ; pas de dépendance au serveur réel pour les tests automatisés.
- Monter une application NestJS de test pour vérifier query validation, HTTP et guards ; un test direct de méthode ne suffit pas.
- Réutiliser `apps/api/vitest.config.ts` et les patterns des specs existants ; placer les tests sous `src/**/*.spec.ts`, le seul motif actuellement exécuté.
- API CommonJS et shared ESM : garder les DTO agent locaux et éviter tout import runtime ESM non configuré.
- Faire un smoke test manuel sur le service local configuré si disponible ; consigner son absence honnêtement.
- Vérifier que l'OpenAPI parse, expose types/enums/defaults/nullabilité, codes d'erreurs et examples sans secrets.
- Vérifier qu'aucun fichier React, configuration Docker ou package inutile n'a été changé.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Epic 6] — besoin Hermes, exigences FR21–FR28, contrats par story.
- [Source: `_bmad-output/planning-artifacts/architecture.md`#API & Communication Patterns] — modules REST, secrets et erreurs.
- [Source: `_bmad-output/planning-artifacts/architecture.md`#Implementation Patterns & Consistency Rules] — camelCase, dates UTC, tests co-localisés.
- [Source: `_bmad-output/planning-artifacts/prds/prd-whatsarr-2026-05-19/prd.md`#Cross-Cutting NFRs] — confidentialité et dégradation.
- [Source: `apps/api/src/modules/plex/plex.service.ts`] — client existant et limites d'appels.
- [Source: `apps/api/src/modules/settings/settings.service.ts`] — accès aux credentials existants.
- [Source: `apps/api/src/main.ts`, `apps/api/src/modules/auth/auth.guard.ts`] — préfixe, validation et protection administrateur.
- [Source: `apps/api/src/modules/monthly-recap/monthly-recap.service.ts`] — lecture Tautulli et comportements récap actuels.
- [Source: `apps/api/package.json`, `apps/api/vitest.config.ts`] — stack déclarée et tests disponibles.
- [Source: `.agents/skills/bmad-create-story/template.md`, `checklist.md`] — contexte prêt pour développement et tâches ouvertes.

## Dev Agent Record

### Agent Model Used

Codex — implementation BMAD sequentielle.

### Debug Log References

164 tests API passent ; lint API et build API passent. Fixtures multi-sections/egalites/episodes et tests HTTP recent executes. Pas de smoke test serveur reel : fallback collecte complete bornee, capacites de tri non supposees.

### Completion Notes List

- Route recent films/series/episodes ; tri global ajoute decroissant et departage deterministe.
- Client catalogue commun : fusion des pages bornees complete avant tri/offset, aucune egalite tronquee.
- Ajout distinct de date de sortie civile ; episodes conserves, zeros et nulls explicites, aucun filtre annonces ni job.
- Search garde son schema sans champs episodes ; imports/recaps existants preserves.

- Les tests automatiques utilisent une base SQLite temporaire et des services controles ; aucune publication de test vers le groupe reel.
- Aucun smoke test avec Plex/Tautulli/WhatsApp reel effectue ; verification en conditions locales reelles a faire avec l'administrateur.

### File List

- `_bmad-output/implementation-artifacts/6-5-consulter-les-derniers-ajouts-plex.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

- `apps/api/src/modules/agent/agent-media.types.ts`
- `apps/api/src/modules/agent/agent-media.dto.ts`
- `apps/api/src/modules/agent/agent-media.controller.spec.ts`
- `apps/api/src/modules/agent/agent.module.ts`
- `apps/api/src/modules/agent/agent.controller.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/agent/hermes-openapi.ts`
- `apps/api/src/modules/plex/plex.service.ts`
- `apps/api/src/modules/plex/plex-catalogue.ts`
- `apps/api/src/modules/plex/plex-recent.spec.ts`
- `docs/hermes-agent.openapi.json`
- `docs/hermes-agent.md`

## Change Log

- 2026-10-12 : implementation et verification story 6.5, prete pour revue.
