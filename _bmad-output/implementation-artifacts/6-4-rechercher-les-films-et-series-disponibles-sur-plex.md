# Story 6.4: Rechercher les films et séries disponibles sur Plex

Status: review

## Story

En tant qu'administrateur utilisant Hermes,
je veux que l'agent recherche les films et séries disponibles sur mon serveur Plex,
afin qu'il prépare des conseils sur des contenus réellement accessibles aux membres.

**Story key :** `6-4-rechercher-les-films-et-series-disponibles-sur-plex`.
**Couverture :** FR21, FR25, NFR3, NFR5, NFR6, NFR7, NFR8, NFR9.
**Prérequis :** 6.1 fournit le module agent, les erreurs et les documents de contrat.
**Indépendance :** la recherche fonctionne sans 6.2, 6.3, 6.5 ou 6.6 et sans WhatsApp connecté.

## Acceptance Criteria

1. **Recherche sans clé et lecture seule.** Étant donné Plex configuré dans Whatsarr, quand Hermes appelle `GET /api/agent/media/search?q=...` sans credentials Hermes, alors HTTP 200 contient `{ items, pagination: { offset, limit, hasMore }, source: "plex" }`. Aucun message, job ou mutation de média n'est effectué.
2. **Contenus et projection.** Les résultats ne contiennent que films et séries : `ratingKey`, `libraryKey`, `title`, `mediaType`, `year`, `summary`, `genres`, `addedAt`. `movie` et `series` sont les types publics ; métadonnées indisponibles explicites, dates UTC, aucun token ou URL Plex authentifiée.
3. **Filtres avant pagination.** `libraryKey` et `mediaType=movie|series` sont facultatifs. Les filtres et la déduplication `(libraryKey, ratingKey)` précèdent la pagination globale. Une page amont contenant zéro correspondance ne suffit pas pour déclarer `hasMore=false`.
4. **Absence de résultats.** Une recherche valide sans correspondance retourne 200, `items: []`, `hasMore:false`. Une panne, un corps inattendu ou une page tronquée ne sont jamais remplacés par cette réponse.
5. **Validation.** `q` est obligatoire, trimé pour la recherche, de 1 à 200 caractères après trim. Type inconnu, query non scalaire, pagination invalide ou champ arbitraire retourne 400 `AGENT_INVALID_REQUEST` avant appel Plex.
6. **Bibliothèque absente.** Une clé demandée qui n'existe pas sur le serveur retourne 404 `PLEX_LIBRARY_NOT_FOUND`. Une bibliothèque existante sans film/série correspondant retourne une liste vide ; ne pas confondre les deux cas.
7. **Erreurs de source.** Configuration incomplète : 409 `PLEX_NOT_CONFIGURED` ; credentials refusés : 502 `PLEX_AUTHENTICATION_ERROR` ; accès impossible/réponse inexploitable : 502 `PLEX_UNREACHABLE` ; deadline 15 secondes dépassée : 504 `PLEX_TIMEOUT`. Chaque erreur porte `requestId` sans secret.
8. **Compatibilité et contrat.** Avec `AUTH_DISABLED=false`, la route agent reste publique localement et une route administrateur reste protégée. Import utilisateurs/bibliothèques et récap existants restent compatibles. OpenAPI et guide montrent une recherche locale exploitable sans clé.

## Contrat API à implémenter

```http
GET /api/agent/media/search?q=Alien&mediaType=movie&libraryKey=1&offset=0&limit=20
Accept: application/json
```

| Query | Type | Règle |
| --- | --- | --- |
| `q` | string | obligatoire, trim, 1–200 caractères |
| `libraryKey` | string | facultatif, clé de section connue, non vide |
| `mediaType` | enum | facultatif, `movie` ou `series` |
| `offset` | integer | 0 par défaut, entier sûr ≥ 0 |
| `limit` | integer | 20 par défaut, 1–100 |

```json
{
  "items": [
    {
      "ratingKey": "153",
      "libraryKey": "1",
      "title": "Alien",
      "mediaType": "movie",
      "year": 1979,
      "summary": "Un équipage reçoit un signal venu d'une planète inconnue.",
      "genres": ["Science-fiction"],
      "addedAt": "2026-10-10T18:30:00.000Z"
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "hasMore": false },
  "source": "plex"
}
```

- Identifiants renvoyés comme chaînes, même si Plex fournit un entier.
- `ratingKey`, `libraryKey`, `title`, `mediaType` sont obligatoires sur un résultat valide.
- `year`, `summary`, `addedAt` valent `null` si absents ou non interprétables ; `genres` vaut `[]`.
- `addedAt` provient d'un timestamp Plex en secondes et devient ISO UTC ; jamais `releaseDate`.
- Le type Plex `show` devient `series` ; `season`, `episode`, musique et collections ne sont pas des résultats de cette route.
- Sémantique V1 : titre contenant la chaîne q, comparaison sans distinction de casse ; le client vérifie cette sémantique même si le serveur applique un filtre approximatif.
- Si une délégation au serveur perd des correspondances valides, employer une collecte paginée bornée côté client ; ne pas altérer la sémantique publique selon le serveur.
- Ne promettre ni recherche plein texte du synopsis, ni scoring sémantique, ni recommandation générée par Whatsarr.
- Ordre stable défini par le client : titre normalisé, puis `libraryKey`, puis `ratingKey`.
- Documenter que l'offset porte sur un catalogue vivant : des ajouts entre deux appels peuvent déplacer les résultats.
- La stabilité garantit le même ordre à source identique, pas un snapshot persistant du serveur.

## Tasks / Subtasks

- [x] 1. Étendre la façade agent et ses DTO (AC: 1, 5, 8).
  - [x] Déclarer la route GET et les types de réponse ; importer `PlexModule` dans `AgentModule`.
  - [x] Ajouter un DTO recherche dédié et réutiliser la pagination commune sans toucher au guard admin.
  - [x] Normaliser seulement les paramètres autorisés ; conserver le `requestId` du contexte agent.
- [x] 2. Ajouter une lecture de catalogue dans `PlexService` (AC: 1, 2, 6, 7).
  - [x] Récupérer les settings Plex serveur et classifier configuration/auth/réseau/timeout.
  - [x] Lire les sections live, vérifier la clé demandée et sélectionner uniquement les sections pertinentes.
  - [x] Utiliser un appel GET et des paramètres construits côté serveur ; transmettre le token en header sur les nouveaux appels si supporté.
  - [x] Ne pas loguer l'URL avec token ni recopier les headers externes.
- [x] 3. Normaliser les métadonnées (AC: 2, 4).
  - [x] Mapper `show` vers `series`, genres et timestamps ; projeter uniquement les champs publics.
  - [x] Définir les comportements pour corps invalide vs champs facultatifs absents.
  - [x] Tester les identifiants en chaînes/entiers, caractères accentués, genres absents et timestamps invalides.
- [x] 4. Livrer une pagination globale correcte (AC: 3, 4).
  - [x] Vérifier filtres/tri Plex supportés avant de les déléguer ; isoler leur traduction dans le client.
  - [x] Dédupliquer avant application de l'offset et départager de façon stable.
  - [x] Chercher une correspondance supplémentaire pour calculer `hasMore` ou utiliser un total fiable après filtres.
  - [x] Continuer les pages nécessaires malgré des lignes non pertinentes ; détecter une pagination amont ignorée.
  - [x] Borner corps/buffers et partager une deadline ; une limite atteinte doit échouer explicitement, jamais fabriquer une page complète.
- [x] 5. Couvrir le contrat et les régressions (AC: 1–8).
  - [x] Ajouter specs client/service/facade et tests HTTP NestJS.
  - [x] Tester la matrice ci-dessous et la préservation des imports Plex.
  - [x] Vérifier l'absence d'appels WhatsApp, outbox, mapping ou TMDB.
- [x] 6. Documenter et vérifier (AC: 8).
  - [x] Étendre le schéma OpenAPI statique et le guide Hermes avec exemples positifs/négatifs.
  - [x] Exécuter tests/lint/build API ; consigner un smoke test local si accessible.

## Dev Notes

### État actuel, modifications et comportements à préserver

| Fichier | État actuel vérifié | Changement attendu | À préserver |
| --- | --- | --- | --- |
| `apps/api/src/modules/plex/plex.service.ts` | `fetchUsers` et `fetchLibraries`, settings déchiffrés, GET, timeout 15 s, parsing JSON/XML, déduplication/tri des comptes/sections | ajouter lecture recherche et normalisation de métadonnées ; nouvelles erreurs typées propres à l'agent | signatures, formes `ImportedPlexUser`/`PlexLibrary`, fallback XML et imports existants |
| `apps/api/src/modules/plex/plex.module.ts` | importe SettingsModule, exporte PlexService | conserver export ; compléter providers seulement si extraction utile | injection existante dans mapping/récap |
| `apps/api/src/modules/settings/settings.service.ts` | fournit secrets via `getDecryptedService`, API publique masque les secrets | READ ONLY, utiliser la méthode actuelle | chiffrement, configuration et absence d'exposition publique |
| `apps/api/src/main.ts` | préfixe api, ValidationPipe global whitelist/forbid/transform ; aucun Swagger | READ ONLY ; réutiliser comportement, normaliser erreurs seulement côté agent | bootstrap, CORS, routes admin |
| `apps/api/src/modules/auth/auth.guard.ts` | guard controller vérifie cookie sauf auth désactivée | READ ONLY | politique administrateur |

### Intégration Plex et recherche officielle

- Référence primaire consultée le 12 octobre 2026 : [Plex Media Server API](https://developer.plex.tv/pms/).
- Cette référence décrit les sections, les media queries et la pagination de conteneur ; les filtres et tris disponibles peuvent dépendre du type et du serveur.
- Vérifier les capacités de section plutôt que supposer qu'un hub de recherche limité représente tout le catalogue.
- `X-Plex-Container-Start/Size` et les totaux amont servent à avancer ; leurs valeurs ne deviennent pas automatiquement la pagination publique après déduplication.
- Utiliser les clés/pivots de type disponibles ; le client transforme le vocabulaire public `series` vers le vocabulaire Plex.
- La traduction précise du filtre titre doit être validée avec une fixture et un smoke test de la version installée.
- Les exemples de la documentation ne prouvent pas que chaque serveur expose les mêmes filtres.
- Éviter l'approche « demander 20 résultats au hub puis filtrer » : elle masque les correspondances suivantes.
- Si une capacité manque, effectuer la normalisation/filtration dans le client avec pages et deadline bornées ; ne pas annoncer un filtrage natif non vérifié.
- Les nouveaux appels ne doivent pas suivre une redirection vers un autre hôte en transportant le token.

### Stratégie de collecte et de pagination

1. Résoudre les sections éligibles et valider la bibliothèque demandée.
2. Utiliser le filtre titre/type natif uniquement lorsque sa sémantique est vérifiée.
3. Si le résultat n'est pas déjà globalement ordonné, collecter les résultats filtrés nécessaires ou épuiser les sources avant découpage.
4. Une fusion paginée est correcte seulement si chaque flux amont suit le même comparateur stable.
5. Trier/dédupliquer avant `slice(offset, offset + limit)` ; garder un élément valide suivant pour `hasMore`.
6. Quand la source refuse une pagination fiable ou excède le budget, retourner une erreur de source/timeout ; pas de résultat partiel trompeur.
7. Ne faire aucun enrichissement supplémentaire par résultat pour un champ facultatif absent.

### Matrice de tests minimale

| Cas | Résultat attendu |
| --- | --- |
| film/serie et type Plex show | types publics cohérents, métadonnées whitelist |
| recherche vide et espaces | 400, aucun fetch |
| `q` 200/201 caractères | accepté/refusé |
| limites 1/100 et 0/101 | validité/refus |
| offset négatif/fractionnaire/Infinity | 400 |
| query tableau/répétée/inconnue | 400 |
| clé existante incompatible avec type | 200 vide |
| clé réellement absente | 404 distinct |
| doublons même section vs deux sections | doublon unique ; entrées différentes conservées |
| correspondances sur page amont suivante | trouvées, hasMore correct |
| résultats multi-bibliothèques | ordre/découpage global stable |
| timeout corps/réseau, 401/403, mauvais JSON | codes dédiés, aucun secret |
| WhatsApp déconnecté, aucun groupe | recherche possible |
| AUTH_DISABLED=false | agent 200, route admin 401 |
| imports comptes/sections JSON/XML | comportement actuel préservé |

### Project Structure Notes

- UPDATE après 6.1 : `apps/api/src/modules/agent/agent.controller.ts`, `agent.module.ts`, `agent.service.ts`.
- UPDATE : `apps/api/src/modules/plex/plex.service.ts` ; `plex.module.ts` seulement si nécessaire.
- NEW : `apps/api/src/modules/agent/agent-media.dto.ts`, `agent-media.types.ts` si non existants après 6.1.
- NEW : `apps/api/src/modules/plex/plex.service.spec.ts`, tests agent media co-localisés.
- UPDATE après 6.1 : `docs/hermes-agent.openapi.json`, `docs/hermes-agent.md`.
- Pas de tables, migration, cache catalogue persistant ou écran UI pour cette story.

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

153 tests API passent ; lint API et build API passes ; tests HTTP de query et clients Plex multi-pages executes. Imports historiques JSON/XML et tests recap preserves. Pas de serveur Plex reel accessible pour confirmer les capacites natives : fallback catalogue pagine et filtre titre client utilise.

### Completion Notes List

- Recherche titre contenant q sans casse, films/series, sections live et projection whitelist.
- Collecte paginee bornee, tri global puis dedup/filtres avant offset ; pages repetees et corps incoherents rejetes.
- Deadline unique 15s incluant corps/parsing, limites corps/memoire ; erreurs source explicites, token header et redirects refuses.
- Aucun job/groupe/session requis pour les lectures.

- Les tests automatiques utilisent une base SQLite temporaire et des services controles ; aucune publication de test vers le groupe reel.
- Aucun smoke test avec Plex/Tautulli/WhatsApp reel effectue ; verification en conditions locales reelles a faire avec l'administrateur.

### File List

- `_bmad-output/implementation-artifacts/6-4-rechercher-les-films-et-series-disponibles-sur-plex.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

- `apps/api/src/modules/agent/agent-source.ts`
- `apps/api/src/modules/agent/agent-media.types.ts`
- `apps/api/src/modules/agent/agent-media.dto.ts`
- `apps/api/src/modules/agent/agent-media.controller.spec.ts`
- `apps/api/src/modules/agent/agent.module.ts`
- `apps/api/src/modules/agent/agent.controller.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/agent/agent.integration.spec.ts`
- `apps/api/src/modules/agent/hermes-openapi.ts`
- `apps/api/src/modules/plex/plex.service.ts`
- `apps/api/src/modules/plex/plex.service.spec.ts`
- `apps/api/src/modules/plex/plex-catalogue.ts`
- `docs/hermes-agent.openapi.json`
- `docs/hermes-agent.md`

## Change Log

- 2026-10-12 : implementation et verification story 6.4, prete pour revue.
