# Story 6.6: Consulter les derniers visionnages Tautulli

Status: review

## Story

En tant qu'administrateur utilisant Hermes,
je veux que l'agent consulte les derniers visionnages connus par Tautulli,
afin que ses sélections et conseils tiennent compte de l'activité réelle du serveur.

**Story key :** `6-6-consulter-les-derniers-visionnages-tautulli`.
**Couverture :** FR21, FR27, NFR3, NFR5, NFR6, NFR7, NFR8, NFR9, NFR10.
**Prérequis :** 6.1 fournit façade/erreurs/docs ; Tautulli configuré via Paramètres existants.
**Indépendance :** pas de dépendance technique à recherche/recent ou à WhatsApp connecté.

## Acceptance Criteria

1. **Historique local sans clé.** Étant donné Tautulli configuré, quand Hermes appelle `GET /api/agent/watch-history` sans clé/token/cookie Hermes, alors HTTP 200 renvoie `{ items, pagination:{ offset, limit, hasMore }, source:"tautulli" }`. Sans période, la première page couvre les derniers visionnages disponibles, sans restriction au mois/récap.
2. **Projection de données.** Une ligne publique contient `userId`, `userName`, `title`, `mediaType`, `ratingKey`, `libraryKey`, `startedAt`, `stoppedAt`, `durationSeconds`, `progressPercent`, `seriesTitle`, `seasonNumber`, `episodeNumber`. Valeurs absentes = null, dates UTC. Ne jamais exposer IP, email, clé, URL authentifiée, session ou corps brut.
3. **Tri et lectures distinctes.** Trier par début le plus récent ; départager les égalités par `row_id` numérique décroissant lorsqu’il existe, avec dates nulles en fin de liste et ordre source conservé en dernier recours. Deux lectures du même film/utilisateur restent deux entrées ; aucune déduplication `(userId,ratingKey)`.
4. **Filtres précis avant pagination.** `userId`, `from`, `to` sont facultatifs. `from` inclusif et `to` exclusif s'appliquent à `startedAt`, avant offset/limit. Un utilisateur sans lecture retourne 200 vide, pas 404.
5. **Validation.** Dates ISO 8601 avec timezone, dates impossibles, période inversée, userId vide/invalide et pagination hors règles retournent 400 `AGENT_INVALID_REQUEST`. L'absence d'une borne est autorisée. Aucun paramètre commande/source arbitraire n'est accepté.
6. **Vide et hasMore.** Historique vide = 200 vide, hasMore false. Le nombre de lignes après normalisation d'une seule page ne suffit pas à déclarer la fin ; continuer la source si nécessaire et distinguer résultat réellement vide d'une erreur.
7. **Erreurs Tautulli.** Configuration incomplète = 409 `TAUTULLI_NOT_CONFIGURED`, auth refusée = 502 `TAUTULLI_AUTHENTICATION_ERROR`, réseau ou erreur applicative/réponse inexploitable = 502 `TAUTULLI_UNREACHABLE`, deadline 15 secondes = 504 `TAUTULLI_TIMEOUT`. Inspecter les erreurs applicatives même lorsque HTTP vaut 200 et masquer les secrets.
8. **Préservation et documentation.** Un client dédié/extrait conserve le fonctionnement du récap existant. Tests films/épisodes/filtres/bornes/pagination/erreurs et protections admin passent. Guide et OpenAPI expliquent historique vs film terminé et l'enchaînement lecture → rédaction Hermes → POST messages.

## Contrat API à implémenter

```http
GET /api/agent/watch-history?userId=42&from=2026-10-01T00%3A00%3A00Z&to=2026-10-12T00%3A00%3A00Z&offset=0&limit=20
```

| Query | Type | Règle |
| --- | --- | --- |
| `userId` | string | facultatif, identifiant numérique Tautulli/Plex non négatif, sans lookup obligatoire du mapping |
| `from` | string | facultatif, ISO 8601 avec Z/offset, début inclusif |
| `to` | string | facultatif, ISO 8601 avec Z/offset, fin exclusive |
| `offset` | integer | défaut 0, entier sûr ≥ 0 |
| `limit` | integer | défaut 20, 1–100 |

```json
{
  "items": [
    {
      "userId": "42",
      "userName": "Sébastien",
      "title": "Le signal",
      "mediaType": "episode",
      "ratingKey": "812",
      "libraryKey": "2",
      "startedAt": "2026-10-11T20:00:00.000Z",
      "stoppedAt": "2026-10-11T20:42:00.000Z",
      "durationSeconds": 2400,
      "progressPercent": 95,
      "seriesTitle": "Exploration",
      "seasonNumber": 2,
      "episodeNumber": 3
    }
  ],
  "pagination": { "offset": 0, "limit": 20, "hasMore": false },
  "source": "tautulli"
}
```

- `userId`, `ratingKey`, `libraryKey` normalisés en chaînes ou null si absents.
- `mediaType` reprend les types Tautulli connus (movie/episode/track/live/collection/playlist), inconnu = null.
- La route ne prend pas un filtre mediaType en V1 : ne pas éliminer silencieusement des lectures autres que movie/episode.
- Épisode : titre d'épisode `title`, série `grandparent_title`, saison `parent_media_index`, épisode `media_index`.
- Films/autres types : champs épisode = null ; aucun regroupement en séries effectué par Whatsarr.
- `started`/`stopped` sont des secondes Unix : conversion vers `startedAt`/`stoppedAt` ISO UTC.
- `durationSeconds` utilise `play_duration` si fourni et valide ; ne pas confondre avec durée totale du fichier.
- Ne pas inventer une durée via `stopped-started`, qui inclurait les pauses et ne prouve pas la lecture effective.
- `percent_complete` devient `progressPercent` si fini et dans [0,100] ; anomalie = null.
- `stopped=0` ou date impossible = null ; valeur `play_duration=0` reste 0.
- `userName` privilégie le friendly_name non email ; ne pas propager un email utilisé comme username.
- Si friendly_name est absent/email, utiliser un username non email ; sinon null.
- Une ligne d'historique indique une session enregistrée, pas une preuve que le contenu est terminé.
- `from == to` décrit une période vide et renvoie 200 vide ; `from > to` est invalide.
- Sans bornes ne pas injecter automatiquement « 30 derniers jours », mois civil, bibliothèques du récap ou utilisateurs mappés.

## Tasks / Subtasks

- [x] 1. Ajouter DTO et façade de consultation (AC: 1, 4, 5, 8).
  - [x] Déclarer GET watch-history sans guard Hermes, réutiliser erreurs et requestId de 6.1.
  - [x] Valider pagination, userId et dates avec timezone/date réelle ; comparer les instants UTC.
  - [x] Conserver des paramètres serveur autorisés et refuser les paramètres amont génériques.
- [x] 2. Créer le client Tautulli dédié (AC: 1, 7).
  - [x] Ajouter TautulliModule/Service utilisant SettingsModule et fetch existant.
  - [x] Construire une commande fixe get_history, credentials en interne, budget global 15 secondes.
  - [x] Lire HTTP, puis enveloppe response/result/message/data ; distinguer failure, auth et payload illisible.
  - [x] Nettoyer erreurs/logs ; ne pas loguer URL `apikey` ni corpo historique.
- [x] 3. Implémenter les filtres et pages (AC: 3, 4, 6).
  - [x] Demander l'historique non regroupé et sans activité courante ; imposer ordre début décroissant.
  - [x] Avant découpage, charger tout le bloc d’égalité du timestamp frontière et trier ses row_id décroissants, ou vérifier un tri secondaire natif équivalent ; placer startedAt null en fin de liste.
  - [x] Passer user_id à la source et vérifier le résultat normalisé.
  - [x] Appliquer bornes UTC exactes après récupération ; les bornes journalières source ne suffisent pas.
  - [x] Avancer via nombre brut de lignes/pages source, garder limit+1 correspondances valides.
  - [x] Utiliser recordsFiltered seulement lorsque ses filtres coïncident réellement avec les filtres publics.
  - [x] Détecter les pages répétées, deadline et limites de corps/mémoire ; aucun faux résultat partiel.
- [x] 4. Normaliser et projeter (AC: 2, 3, 6).
  - [x] Mapper champs et conversions définis dans le contrat, conserver les lectures répétées distinctes.
  - [x] Conserver un identifiant de ligne interne pour tri/progression, sans exposer autres colonnes privées.
  - [x] Nettoyer userName email et ne retourner que whitelist publique.
  - [x] Définir comportement startedAt absent : conserver null sans filtre temporel, exclure de période explicite.
- [x] 5. Préserver le récap existant (AC: 8).
  - [x] Privilégier client nouveau sans modifier MonthlyRecapService pour réduire le risque.
  - [x] Si extraction décidée, maintenir signature/période/bibliothèques/classement et fixtures du récap.
  - [x] Ne pas appeler runMonthlyRecap pour répondre à l'agent : cela écrit des runs/logs et peut créer un job.
- [x] 6. Tests et docs (AC: 1–8).
  - [x] Ajouter client/facade/HTTP specs et matrice ci-dessous.
  - [x] Ajouter route/schémas/examples/erreurs OpenAPI et guide local sans clé.
  - [x] Exécuter tests/lint/build API ; contrôler tests récap et smoke test Tautulli si disponible.

## Dev Notes

### Code actuel vérifié et choix d'extension

| Fichier | État actuel | Changement prévu | À préserver |
| --- | --- | --- | --- |
| `apps/api/src/modules/monthly-recap/monthly-recap.service.ts` | client get_history privé, pages 1000 par bibliothèque, before/after dates locales, mapping dédié puis classement utilisateurs distincts, scheduler/job/runs | READ ONLY par défaut ; extraction optionnelle seulement après relecture intégrale | top 5 par bibliothèque, fenêtre glissante 30 jours, groupement épisodes vers série, anti-doublon récap et scheduler |
| `apps/api/src/modules/monthly-recap/monthly-recap.module.ts` | importe settings/Plex/notifications/WhatsApp et fournit recap/status | READ ONLY par défaut ; importer TautulliModule uniquement si extraction | DI, scheduler et routes status existantes |
| `apps/api/src/modules/settings/settings.service.ts` | service tautulli déchiffré, settings publics masqués | READ ONLY | aucune copie de credential dans contrat agent |
| `apps/api/src/modules/auth/auth.guard.ts` | cookie session admin contrôlé sur controllers protégés | READ ONLY | admin protégé même quand agent accessible localement |

- Aucun module `tautulli` n'existe actuellement : ajouter un domaine dédié ne remplace pas un client déjà partagé.
- Le client privé du récap ignore actuellement `response.result` ; ne pas reproduire ce comportement dans le nouveau client.
- Le normaliseur récap perd les timestamps/durations/progression ; il ne peut pas servir directement de contrat agent.
- Ses méthodes privées ne doivent pas devenir publiques uniquement pour contourner une frontière de module.
- L'option privilégiée est client Tautulli dédié pour Hermes et récap intact ; une extraction mutualisée doit justifier le changement et ses tests.
- Les bibliothèques `included` et `notificationIncluded` concernent récap/annonces, pas visibilité de l'historique agent.

### Documentation primaire consultée

- [Tautulli API Reference — get_history](https://github.com/Tautulli/Tautulli/wiki/Tautulli-API-Reference#get_history), consultée le 12 octobre 2026.
- Paramètres pertinents : grouping/include_activity, user_id, ordre, pagination ; les bornes before/after utilisent des jours inclusifs.
- Demander `grouping=0`, `include_activity=0`, `order_column=started`, `order_dir=desc` pour l'historique V1.
- Ces paramètres appartiennent au client interne ; ils ne deviennent pas des paramètres publics arbitraires.
- Les valeurs appliquées aux bornes UTC et le masque des emails sont des garanties Whatsarr, pas des capacités présumées de Tautulli.
- Respecter le chemin d'installation de l'instance configurée ; tester une base avec sous-chemin reverse proxy si supportée.
- Ne pas ajouter un SDK Python ou une mise à jour de stack pour consommer cette API REST.

### Bornes exactes et pagination source

1. Sans période, utiliser la pagination amont directement si l'ordre/projection sont compatibles.
2. Avec période, avancer depuis le début du flux trié ou utiliser un préfiltre journalier suffisamment large et vérifié.
3. `before`/`after` ne garantissent pas `[from,to)` ; ne jamais tronquer l'heure/timezone et croire le filtre exact.
4. Si timezone Tautulli inconnue, ne pas utiliser le préfiltre journalier susceptible d'exclure des lignes ; comparer les timestamps Unix côté Whatsarr.
5. Filtrer `startedAt >= from` et `startedAt < to` avant offset ; avec une seule borne appliquer uniquement celle-ci.
6. Continuer les pages nécessaires malgré zéro match sur une page ; s'arrêter quand les dates triées ne peuvent plus correspondre.
7. Obtenir `offset + limit + 1` lignes correspondantes ; hasMore signifie qu'une ligne publique supplémentaire existe.
8. Ne pas incrémenter start selon le nombre normalisé/filtré ; avancer selon les lignes source consommées.
9. `recordsFiltered` n'est fiable pour les filtres publics que si le préfiltre est exact ; sinon ne pas le transformer en total public.
10. À dépassement de deadline, timeout explicite ; à pagination incohérente/corps inexploitable, erreur source.
11. Pas de cache complet ni chargement non borné de tout l'historique ; la réponse publique reste au plus 100 lignes.
12. Les lignes identiques peuvent être des sessions distinctes : conserver row_id interne pour reconnaître des pages répétées, sans dédupliquer par contenu.
13. Le tri source `started DESC` ne garantit pas l’ordre des égalités : terminer le bloc de timestamp à la frontière de page avant de trier numériquement `row_id DESC` et d’appliquer offset/limit. Si l’identifiant manque, conserver l’ordre source comme dernier recours. Placer les dates nulles après les dates valides. Un bloc dépassant le budget doit produire une erreur explicite.

### Matrice de tests minimale

| Cas | Attendu |
| --- | --- |
| film et épisode | projection complète sans champ privé |
| deux lectures même user/ratingKey | deux lignes |
| timestamp égal sur deux pages, row_id différents | bloc complet, row_id décroissants, pagination sans perte |
| startedAt null sans période / avec période | fin de liste / exclu |
| absence de période | dernières lectures toutes périodes |
| user connu sans historique / inconnu | 200 vide |
| timestamp égal à from | inclus |
| timestamp égal à to | exclu |
| timezone +02:00 équivalente à Z | même instant/filtre |
| intervalle inverse, 30 février, sans timezone | 400 |
| une seule borne from/to | filtrage correspondant |
| page initiale sans match suivie d'une page pertinente | continuation, pagination exacte |
| filtrage laisse 0 lignes mais source continue | pas de faux hasMore false |
| friendly_name ou user contenant email | aucun email exposé |
| play_duration/progress absents ou zéros | null/0 cohérents |
| réponse HTTP 200 response.result=error | 502, jamais liste vide |
| auth HTTP ou erreur applicative d'auth reconnue | TAUTULLI_AUTHENTICATION_ERROR |
| fetch/body timeout | 504, requête annulée |
| payload/data malformés | TAUTULLI_UNREACHABLE |
| source répète même page | boucle arrêtée, erreur explicite |
| aucun groupe, WhatsApp hors ligne | historique accessible |
| AUTH_DISABLED=false | agent accessible, admin protégé |
| tests récap existants | aucune régression ni job agent de lecture |

### Project Structure Notes

- NEW : `apps/api/src/modules/tautulli/tautulli.module.ts`, `tautulli.service.ts`, `tautulli.types.ts`, `tautulli.service.spec.ts`.
- UPDATE après 6.1 : `apps/api/src/modules/agent/agent.module.ts`, `agent.controller.ts`, `agent.service.ts`.
- NEW : DTO historique agent et specs co-localisés, ou enrichir le DTO commun s'il existe au développement.
- UPDATE après 6.1 : `docs/hermes-agent.openapi.json`, `docs/hermes-agent.md`.
- READ ONLY privilégié : MonthlyRecapService/Module ; tout changement doit être précédé d'une relecture complète et couvert par ses specs.
- Aucun changement Prisma, frontend, credentials Hermes ou exposition publique internet.

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

195 tests API et 3 tests UI SSR passent ; lint API/web et builds API/shared/web passent. Smoke app compilee : modules et DI reels, SQLite temporaire, contrat OpenAPI embarque identique au JSON, six routes, erreurs JSON et protection admin verifies. Aucun service externe contacte.

### Completion Notes List

- Client Tautulli dedie : aucune extraction ni modification du recap existant.
- Historique non regroupe, bornes UTC exactes avant pagination, lectures distinctes, bloc timestamp complet et tri row_id ; dates nulles en fin.
- Enveloppe applicative success/error verifiee, credentials internes, erreurs source sans secrets ; user 0 et sous-chemins supportes.
- Deadline/buffers/pagination bornes reutilisent AgentSourceSession ; parcours arrete quand le prefixe correct est etabli.
- Verification finale corrige aussi correlation des routes Express sans casse, nettoyage des anciens logs, conflits P2002 sur bonne contrainte et construction des URL source.

- Les tests automatiques utilisent une base SQLite temporaire et des services controles ; aucune publication de test vers le groupe reel.
- Aucun smoke test avec Plex/Tautulli/WhatsApp reel effectue ; verification en conditions locales reelles a faire avec l'administrateur.

### File List

- `_bmad-output/implementation-artifacts/6-6-consulter-les-derniers-visionnages-tautulli.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

- `apps/api/src/modules/tautulli/tautulli.types.ts`
- `apps/api/src/modules/tautulli/tautulli.module.ts`
- `apps/api/src/modules/tautulli/tautulli.service.ts`
- `apps/api/src/modules/tautulli/tautulli.service.spec.ts`
- `apps/api/src/modules/agent/agent-history.dto.ts`
- `apps/api/src/modules/agent/agent-history.controller.spec.ts`
- `apps/api/src/modules/agent/agent.module.ts`
- `apps/api/src/modules/agent/agent.controller.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/agent/agent.integration.spec.ts`
- `apps/api/src/modules/agent/agent-media.controller.spec.ts`
- `apps/api/src/modules/agent/agent-exception.filter.ts`
- `apps/api/src/modules/agent/hermes-openapi.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/plex/plex-catalogue.ts`
- `apps/api/scripts/hermes-smoke.cjs`
- `docs/hermes-agent.openapi.json`
- `docs/hermes-agent.md`

## Change Log

- 2026-10-12 : implementation et verification story 6.6, prete pour revue.
