# Hermes et Whatsarr sur le réseau local

L'agent appelle Whatsarr sur `http://IP_WHATSARR:3000/api/agent`, sans clé Hermes ni cookie, même lorsque l'interface administrateur exige une connexion. Whatsarr utilise sa session WhatsApp et son groupe serveur configuré. Hermes rédige les news et conseils et gère leur calendrier.

Pour appeler librement les API des services configurés, utilise `POST /api/agent/relay` : méthode, chemin natif, paramètres et corps au choix, identifiants injectés par Whatsarr. Le relais n’applique aucun filtre Récap. Les sections précédentes du guide décrivent aussi les routes métier historiques ; la section Relais générique ci-dessous donne le contrat complet.

Le contrat disponible est `GET /api/agent/openapi.json` ([version JSON](hermes-agent.openapi.json)). Les champs inconnus et cibles arbitraires sont refusés.

```bash
curl -X POST http://localhost:3000/api/agent/messages \
  -H 'Content-Type: application/json' \
  -d '{"messageId":"hermes-news-2026-10-12-001","text":"Conseil du soir : Dune."}'
```

202 indique un job persistant accepté, pas encore envoyé. Une répétition avec le même messageId et le même contenu renvoie 200, `deduplicated: true`, le même job et son état courant. Garder le même messageId lors des retries HTTP ; changer intentionnellement le message exige un nouvel identifiant. Réutiliser l'identifiant avec un autre texte donne 409 `AGENT_MESSAGE_ID_CONFLICT`. Un replay d'un job failed ne le relance pas ; l'administrateur peut le relancer dans Messages.

Le groupe choisi à l'acceptation reste la cible, même après changement du groupe serveur. Un nouveau message sans groupe configuré retourne 409 `WHATSAPP_GROUP_NOT_SELECTED`. WhatsApp déconnecté laisse le worker traiter l'envoi avec trois essais maximum, séparés par 1 puis 2 minutes ; le worker tourne toutes les 15 secondes. Un crash après acceptation WhatsApp mais avant persistance ne garantit pas exactement une livraison ; les jobs processing ne sont pas remis aveuglément en attente.

`messageId` non blanc : 128 unités UTF-16 maximum. `text` non blanc : 4000 unités UTF-16 maximum. La mesure est `.length` JavaScript (un emoji hors BMP vaut généralement deux unités). Le texte est conservé tel quel, avec retours à la ligne et `{{variables}}` littérales.

Erreurs : `{ "error": { "code": "AGENT_INVALID_REQUEST", "message": "...", "requestId": "..." } }`. Le requestId du POST identifie cet appel ; le job conserve celui de la première création. Les secrets, stacktraces et erreurs SQL ne sont jamais rendus à Hermes. Les corps invalides ou JSON malformés donnent 400 ; un corps dépassant la limite HTTP donne 413.

## Photo et légende

```bash
curl -X POST http://localhost:3000/api/agent/messages \
  -H 'Content-Type: application/json' \
  -d '{"messageId":"hermes-dune-photo-001","text":"Dune, disponible sur Plex.","imageUrl":"http://hermes:8080/photos/dune.jpg"}'
```

Une photo HTTP(S) JPEG/PNG, 10 Mio maximum, légende obligatoire de 1000 unités UTF-16 maximum. IP privées et noms LAN sont acceptés ; file:, data:, chemins locaux et URL avec identifiants sont refusés. Le conteneur Whatsarr doit pouvoir joindre cette URL. Cinq redirections maximum ; budget total 15 secondes, y compris corps. Conserver la même URL et ses octets disponibles jusqu’au statut terminal. L’identité du message inclut la référence URL exacte, pas une empreinte de l’image. Modifier/ajouter/supprimer l’image sous le même messageId donne 409.

Le téléchargement a lieu dans le worker ; le POST n’attend pas l’image. Un échec image ne publie aucun texte de secours : retries puis failed. Codes persistés : AGENT_IMAGE_UNREACHABLE, AGENT_IMAGE_TIMEOUT, AGENT_IMAGE_TOO_LARGE, AGENT_IMAGE_INVALID, AGENT_IMAGE_REDIRECT_INVALID. Les mêmes octets vérifiés sont transmis à l’adapter. Les affiches des notifications historiques gardent leur chemin existant.

## Suivre le job

Après le POST, consulter `GET /api/agent/messages/JOB_ID` sans cookie. La réponse contient jobId, messageId, source, status, attempts, createdAt, sentAt, failedAt, lastError et requestId initial. Aucun contenu, URL, cible ou clé interne. Un job absent ou appartenant à un autre type retourne 404 AGENT_MESSAGE_NOT_FOUND.

États : pending (accepté), processing (tentative en cours), retry_scheduled (prochain essai prévu), sent (transport accepté, sans preuve de lecture), failed (essais épuisés). GET ne relance ni ne modifie le job. La page Messages administrateur montre Hermes et les identifiants ; les logs de répétition portent le requestId courant et originRequestId initial.

```bash
curl http://localhost:3000/api/agent/messages/JOB_ID
```

## Catalogue Plex et bibliothèques autorisées

Hermes peut consulter les films et séries présents dans Plex avec `GET /api/agent/media/catalogue`. Seules les bibliothèques dont la case **Récap** est cochée dans la gestion des bibliothèques sont accessibles. La case des messages automatiques seule ne donne pas accès à l’agent. Cette sélection s’applique aussi aux anciennes routes de recherche et de derniers ajouts Plex ; elle est relue à chaque appel. Le relais générique Plex décrit plus bas conserve les droits natifs du compte, sans ce filtre.

```bash
# Films et séries, première page
curl 'http://localhost:3000/api/agent/media/catalogue?offset=0&limit=100'

# Films uniquement, puis séries uniquement
curl 'http://localhost:3000/api/agent/media/catalogue?mediaType=movie&offset=0&limit=100'
curl 'http://localhost:3000/api/agent/media/catalogue?mediaType=series&offset=0&limit=100'

# Une bibliothèque autorisée précise
curl 'http://localhost:3000/api/agent/media/catalogue?libraryKey=1&limit=20'
```

La réponse est `{ items, pagination: { offset, limit, hasMore }, source: "plex" }`, avec les mêmes métadonnées que la recherche ci-dessous. Filtres facultatifs : libraryKey, mediaType (movie/series), offset >= 0, limit de 1 à 100 (20 par défaut). Aucun q n’est requis ou accepté. Pour parcourir la liste, augmenter offset de limit tant que hasMore vaut true. Le tri par titre est global entre les bibliothèques autorisées et précède la pagination ; le catalogue reste vivant entre deux appels.

Aucune bibliothèque cochée Récap : liste vide, sans consultation du catalogue Plex. libraryKey inexistant ou exclu du récap lorsqu’il est fourni : 404 PLEX_LIBRARY_NOT_FOUND. Plex doit être configuré ; les autres erreurs et limites sont celles de la recherche. Les épisodes se consultent via les derniers ajouts, pas dans cette liste de films et séries.

## Rechercher dans Plex

```bash
curl 'http://localhost:3000/api/agent/media/search?q=Alien&mediaType=movie&offset=0&limit=20'
```

Films et séries disponibles dans les bibliothèques Plex activées pour le Récap (`movie` et `series`). `q` obligatoire, trimé, 1–200 unités UTF-16 ; titre contenant q sans distinction de casse. Filtres facultatifs libraryKey et mediaType, offset >=0, limit 1–100 (défaut 20). Les types répétés/tableaux, paramètres inconnus et nombres ambigus sont refusés. Les métadonnées publiques sont ratingKey, libraryKey, title, mediaType, year, summary, genres, addedAt ; les champs facultatifs absents restent null/genres []. Aucun token, chemin vidéo ou URL authentifiée.

La réponse est `{ items, pagination: { offset, limit, hasMore }, source: "plex" }`. Bibliothèque inexistante ou exclue du Récap : 404 PLEX_LIBRARY_NOT_FOUND ; bibliothèque existante sans correspondance : 200 vide. Source non configurée : 409 PLEX_NOT_CONFIGURED ; refus des identifiants : 502 PLEX_AUTHENTICATION_ERROR ; réseau/corps/pagination invalide : 502 PLEX_UNREACHABLE ; délai total dépassé : 504 PLEX_TIMEOUT. Ces lectures fonctionnent sans groupe ni session WhatsApp et ne créent aucun job.

La V1 vérifie le titre côté client sur des pages de catalogue, sans dépendre d’un hub limité ou d’un filtre approximatif. Tri titre sans casse, libraryKey, ratingKey ; déduplication par bibliothèque/identifiant avant pagination. Le catalogue est vivant : l’offset peut bouger entre appels. Budget total 15s, 4 Mio par corps, 32 Mio cumulés, 20 000 lignes amont et 200 pages par section maximum. Si ces limites empêchent une réponse complète, la route retourne une erreur explicite ; aucun résultat partiel trompeur. Aucun SDK ni changement du client historique d’import JSON/XML.

Références serveur : [API Plex officielle](https://developer.plex.tv/pms/), [commandes URL Plex](https://support.plex.tv/articles/201638786-plex-media-server-url-commands/). Le token configuré est transmis uniquement au serveur par header ; les redirections sont refusées.

## Derniers ajouts Plex

```bash
curl 'http://localhost:3000/api/agent/media/recent?mediaType=episode&offset=0&limit=20'
```

Seules les bibliothèques activées pour le Récap sont consultées. Filtres facultatifs libraryKey et mediaType (movie/series/episode) ; pagination et erreurs identiques à search. Sans type, inclure les trois catégories, sans saisons/collections. Tri global addedAt décroissant puis libraryKey/ratingKey ; dates manquantes en fin. La réponse ajoute releaseDate (date civile YYYY-MM-DD), seriesTitle, seasonNumber et episodeNumber (null hors épisode). Saison/épisode zéro sont conservés.

Un film de 1979 ajouté hier apparaît selon son ajout, sans fenêtre de six mois. Un épisode reste un épisode ; il n'est pas agrégé en une nouvelle série artificielle. Aucun job/annonce/récap n'est lancé. Le client utilise les listes de section/type (types Plex 1/2/4), et non un hub regroupant les derniers ajouts. Tant que les capacités de tri du serveur réel ne sont pas confirmées, la V1 fusionne les pages bornées puis trie le résultat complet côté client ; limites de collecte identiques à search, erreur explicite si le catalogue dépasse le budget. Les égalités sur plusieurs pages sont ainsi complètes avant découpage.

## Derniers visionnages Tautulli

```bash
curl 'http://localhost:3000/api/agent/watch-history?userId=42&from=2026-10-01T00%3A00%3A00Z&to=2026-10-12T00%3A00%3A00Z&offset=0&limit=20'
```

Sans période, retourner les dernières lectures disponibles, pas seulement le mois du récap. Filtres userId/from/to facultatifs ; userId numérique non négatif (0 accepté). Dates ISO calendrier avec heure, secondes et timezone Z ou ±HH:mm ; fractions jusqu'aux millisecondes. `from` inclusif, `to` exclusif sur startedAt ; une borne seule est permise, égalité = période vide, inversion = 400. Utilisateur inconnu/sans lecture = 200 vide.

La réponse est `{ items, pagination, source: "tautulli" }`. Chaque lecture expose userId, userName, title, mediaType, ratingKey, libraryKey, startedAt, stoppedAt, durationSeconds, progressPercent, seriesTitle, seasonNumber et episodeNumber ; valeurs absentes null. Durée = play_duration effective si disponible, progression = percent_complete valide. Pas de durée inventée incluant les pauses. Historique indique une session enregistrée, pas une preuve de film terminé. Emails, IP, identifiants de session, URL et objets bruts restent internes.

Le client demande get_history, grouping=0, include_activity=0, started DESC. Il avance selon les lignes source, applique les bornes UTC avant pagination et termine les blocs d'égalité avant de départager row_id décroissants (identifiants présents avant absents, puis ordre source). Les lectures répétées restent distinctes. Dates manquantes en fin ; exclues lorsqu'une borne temporelle est fournie. Aucun regroupement d'épisodes vers la série, filtre bibliothèque du récap ou mapping obligatoire.

Le budget de lecture est partagé entre pages : 15s, 4 Mio par corps, 32 Mio cumulés, 20 000 lignes/200 pages maximum. Le parcours s'arrête dès qu'une page exacte et sa ligne supplémentaire sont établies, après résolution des égalités ; une limite atteinte retourne une erreur explicite. Les totaux amont ne deviennent pas un total public après filtrage UTC. Erreurs : 409 TAUTULLI_NOT_CONFIGURED ; 502 TAUTULLI_AUTHENTICATION_ERROR/TAUTULLI_UNREACHABLE ; 504 TAUTULLI_TIMEOUT. Les échecs applicatifs HTTP 200 sont détectés.

Le client respecte le sous-chemin de l'installation, refuse les redirections et utilise la clé configurée côté serveur. Le paramètre apikey est conservé pour compatibilité avec les anciennes instances ; il n'est jamais logué ou renvoyé à Hermes. [Référence Tautulli officielle](https://github.com/Tautulli/Tautulli/wiki/Tautulli-API-Reference#get_history). Le calcul et le scheduler du récap utilisent leur chemin existant.

Hermes peut donc lire catalogue/search/recent/watch-history, rédiger ses news ou conseils, puis envoyer un POST messages et suivre le job. Whatsarr ne génère ni ne planifie les conseils à sa place.

## TMDB : recherche, recommandations et tendances

Hermes utilise la clé TMDB déjà enregistrée dans Paramètres de Whatsarr. Il n'a besoin ni de cette clé, ni d'un cookie. Une clé API v3 ou un jeton API Read Access Token (Bearer) est accepté. Les lectures fonctionnent indépendamment de WhatsApp et ne créent aucun message.

Deux routes donnent accès au catalogue public de l'API TMDB v3 :

- `GET /api/agent/tmdb/catalogue` : les 116 chemins disponibles, leurs paramètres, types et champs obligatoires. Disponible même sans clé TMDB.
- `GET /api/agent/tmdb?path=CHEMIN` : une lecture TMDB. Le chemin ne commence ni par `/3/` ni par une URL. Ajouter directement les paramètres TMDB à la query string, avec encodage URL.

```bash
# Rechercher un film ou une série
curl --get http://localhost:3000/api/agent/tmdb \
  --data-urlencode 'path=search/movie' --data-urlencode 'query=Dune'
curl --get http://localhost:3000/api/agent/tmdb \
  --data-urlencode 'path=search/tv' --data-urlencode 'query=Severance'

# Recommandations et titres similaires à un ID TMDB
curl 'http://localhost:3000/api/agent/tmdb?path=movie/438631/recommendations&page=1'
curl 'http://localhost:3000/api/agent/tmdb?path=movie/438631/similar'
curl 'http://localhost:3000/api/agent/tmdb?path=tv/95396/recommendations'
curl 'http://localhost:3000/api/agent/tmdb?path=tv/95396/similar'

# Tendances du jour ou de la semaine
curl 'http://localhost:3000/api/agent/tmdb?path=trending/movie/day'
curl 'http://localhost:3000/api/agent/tmdb?path=trending/tv/week'

# Détails avec acteurs et bandes-annonces
curl 'http://localhost:3000/api/agent/tmdb?path=movie/438631&append_to_response=credits,videos'

# Découvrir des films de science-fiction bien notés
curl --get http://localhost:3000/api/agent/tmdb \
  --data-urlencode 'path=discover/movie' \
  --data-urlencode 'with_genres=878' \
  --data-urlencode 'vote_average.gte=7' \
  --data-urlencode 'vote_count.gte=100' \
  --data-urlencode 'sort_by=popularity.desc'

# Catalogue des autres possibilités et paramètres
curl http://localhost:3000/api/agent/tmdb/catalogue
```

Les données sont retournées sous la forme `{ source: "tmdb", path: "movie/438631/recommendations", data: { page: 1, results: [], total_pages: 0, total_results: 0 }, attribution: "..." }`. Le champ data conserve le format TMDB : certains endpoints renvoient un objet, d'autres un tableau. La pagination reste celle de TMDB : page commence à 1, au plus 500 ; parcourir total_pages quand présent. Pas de total inventé ni de mélange avec la pagination Plex.

Par défaut, les routes proposant language utilisent fr-FR. On peut demander `language=en-US` et `region=FR` lorsque le catalogue de la route prévoit ces paramètres. Les noms de filtres à points (`vote_average.gte`), les valeurs séparées par virgule ou barre verticale et les autres options de discover sont conservés.

Autres exemples de chemins publics :

| Besoin | Chemin TMDB dans path |
| --- | --- |
| Rechercher films, séries et personnes ensemble | `search/multi` avec query |
| Films populaires, mieux notés, à venir, à l'affiche | `movie/popular`, `movie/top_rated`, `movie/upcoming`, `movie/now_playing` |
| Séries populaires, mieux notées, diffusées aujourd'hui | `tv/popular`, `tv/top_rated`, `tv/airing_today`, `tv/on_the_air` |
| Détails d'une série, saison ou épisode | `tv/95396`, `tv/95396/season/1`, `tv/95396/season/1/episode/1` |
| Distribution, affiches, traductions, bandes-annonces, critiques | `movie/438631/credits`, `movie/438631/images`, `movie/438631/translations`, `movie/438631/videos`, `movie/438631/reviews` (également disponibles pour les séries) |
| Plateformes de diffusion par pays | `movie/438631/watch/providers`, `tv/95396/watch/providers` |
| Genres de films et séries | `genre/movie/list`, `genre/tv/list` |
| Filmographie d'une personne | `person/287/combined_credits` |
| Retrouver un titre depuis IMDb | `find/tt1160419` avec external_source=imdb_id |
| Collection, entreprise, chaîne, mot-clé, listes publiques | familles `collection`, `company`, `network`, `keyword`, `list` du catalogue |
| Tailles et URL des images | `configuration` |

Pour une affiche, utiliser data.poster_path avec la base d'images et une taille issues de `configuration` (par exemple `https://image.tmdb.org/t/p/w500` suivi du poster_path). Pour une bande-annonce YouTube, lire videos.results, sélectionner un résultat adapté puis utiliser son key avec `https://www.youtube.com/watch?v=KEY`. Les données des plateformes proviennent de JustWatch via TMDB ; conserver les liens et attributions fournis.

Les recommandations TMDB sont liées au film ou à la série choisi ; elles ne sont pas personnalisées automatiquement avec l'historique Plex. Pour proposer un conseil personnalisé, Hermes peut lire watch-history, retrouver le titre dans TMDB, consulter recommendations/similar, puis vérifier sa disponibilité avec media/search avant de rédiger son conseil. TMDB décrit le catalogue mondial : un résultat ne prouve pas sa présence sur ton Plex. L'envoi au groupe reste un appel explicite à POST messages avec le texte et éventuellement imageUrl.

Cet accès couvre toutes les lectures publiques v3 recensées dans le contrat officiel TMDB au 13 octobre 2026. Les opérations de compte personnel (notes, favoris, watchlist), création de sessions et écritures exigent une authentification utilisateur TMDB distincte et ne sont pas exposées. Les chemins sont validés contre le catalogue ; une nouvelle route TMDB doit être ajoutée au catalogue Whatsarr. append_to_response accepte jusqu'à 10 sous-routes publiques du chemin demandé.

Paramètres à plat uniquement : les paramètres répétés, tableaux, objets imbriqués, chemins arbitraires, clés API ou identifiants de session transmis par l'agent sont refusés. Un appel contient au plus 80 paramètres de 2048 caractères chacun et 8000 caractères au total, avec un délai total de 15 secondes et un corps de réponse de 4 Mio maximum. L'hôte est toujours api.themoviedb.org et les redirections sont refusées. Les erreurs amont sont rendues sans clé, URL authentifiée ni corps d'erreur TMDB.

Erreurs : 400 AGENT_INVALID_REQUEST (validation locale) ou TMDB_BAD_REQUEST (paramètres refusés par TMDB), 404 TMDB_NOT_FOUND, 409 TMDB_NOT_CONFIGURED, 429 TMDB_RATE_LIMITED (espacer les appels avant de réessayer), 502 TMDB_AUTHENTICATION_ERROR/TMDB_UNREACHABLE, 504 TMDB_TIMEOUT. Chaque erreur conserve le format agent avec requestId.

Sources : [référence API TMDB](https://developer.themoviedb.org/reference/intro/getting-started), [contrat officiel utilisé pour le catalogue](https://developer.themoviedb.org/openapi/tmdb-api.json), [authentification](https://developer.themoviedb.org/docs/authentication-application). Les résultats comprennent l'attribution : This product uses the TMDB API but is not endorsed or certified by TMDB.

## Collections Plex, demandes et acquisitions

Ces routes réutilisent les URL et clés des Paramètres de Whatsarr. Aucun secret Arr ou Seerr n’est remis à Hermes. Configure Radarr, Sonarr et Overseerr (utilisé aussi pour Seerr) avant les appels. Les lectures Arr/Seerr ne sont pas limitées aux bibliothèques Récap ; les collections et la disponibilité Plex le sont. Ces appels n’envoient aucun message WhatsApp.

### Collections Plex

`GET /api/agent/media/collections?libraryKey=1&q=Saga&offset=0&limit=20` renvoie `source`, `items` (id, libraryKey, title, summary, childCount, collectionType) et `pagination` (offset, limit, hasMore). Tous les filtres sont facultatifs. Tri stable par titre, bibliothèque et identifiant ; limite de 1 à 100, 20 par défaut. Aucune bibliothèque Récap sélectionnée donne une liste vide.

`GET /api/agent/media/collections/123/items?offset=0&limit=20` renvoie les films/séries au format du catalogue Plex. `q` et `libraryKey` sont facultatifs. L’appartenance de la collection à une bibliothèque Récap est vérifiée avant lecture ; une collection exclue donne 404 sans lecture de son contenu.

### Suivi Radarr et Sonarr

`GET /api/agent/radarr/movies?q=Dune&tagId=2&monitored=true&offset=0&limit=20`

`GET /api/agent/sonarr/series?offset=0&limit=20`

Filtres facultatifs : `q` (titre), `tagId` (ID positif), `monitored` (true/false), `offset` et `limit`. La réponse expose `source`, `items`, `pagination`. Chaque titre contient id, title, tmdbId, tvdbId, year, monitored, status, tags (id/libellé). Films : hasFile. Séries : episodeFileCount et episodeCount. Un titre suivi n’est pas nécessairement téléchargé ; une série avec quelques épisodes ne signifie pas complète.

`GET /api/agent/radarr/tags` et `GET /api/agent/sonarr/tags` listent les tags existants. `GET /api/agent/radarr/options` et `GET /api/agent/sonarr/options` exposent qualityProfiles (id/name), rootFolders (id/path/accessible/freeSpace) et tags. Employer ces IDs lors des ajouts.

`GET /api/agent/radarr/lookup?tmdbId=550` ou `GET /api/agent/sonarr/lookup?tvdbId=121361` résout un identifiant exact via le catalogue Arr. La recherche textuelle TMDB déjà documentée aide à trouver les identifiants ; ne pas convertir un ID TMDB en TVDB par supposition.

### Ajouts directs et effets

`POST /api/agent/radarr/movies` ajoute directement un film dans Radarr. `POST /api/agent/sonarr/series` ajoute directement une série dans Sonarr, sans créer de demande Seerr. `qualityProfileId` et `rootFolderId` sont obligatoires ; leurs choix et tous les tags doivent exister dans le service cible. Whatsarr résout lui-même les métadonnées depuis le lookup. Les chemins/métadonnées libres sont refusés.

```bash
curl -X POST http://IP_WHATSARR:3000/api/agent/radarr/movies \
  -H 'Content-Type: application/json' \
  -d '{"tmdbId":550,"qualityProfileId":1,"rootFolderId":1,"tagIds":[2],"monitored":true,"search":false}'

curl -X POST http://IP_WHATSARR:3000/api/agent/sonarr/series \
  -H 'Content-Type: application/json' \
  -d '{"tvdbId":121361,"qualityProfileId":1,"rootFolderId":1,"tagIds":[],"seasonNumbers":[1],"monitored":true,"search":false}'
```

Ces exemples créent réellement un suivi lorsqu’ils sont exécutés : adapter les identifiants et les options. `monitored=true` par défaut autorise les acquisitions futures par le service. `search=false` par défaut ne lance pas de recherche immédiate ; `search=true` peut déclencher des téléchargements immédiatement. Sonarr suit par défaut les saisons hors spéciaux ; seasonNumbers permet la sélection explicite, y compris saison 0. Un tableau vide ne suit aucune saison.

Réponse 201 : `source`, `item`, `deduplicated:false`. Réponse 200 : `deduplicated:true`, titre existant strictement inchangé (profil, tags et suivi existants conservés). Les ajouts simultanés sur le même identifiant sont sérialisés dans l’instance Whatsarr ; les conflits amont sont reconsultés. Une panne du journal ne répète jamais l’ajout.

Après un délai dépassé ou une réponse perdue lors du POST, Whatsarr relit le suivi. Si le titre est confirmé, la réponse porte `reconciled:true`. Sinon `ARR_ADD_UNCERTAIN` signale une issue inconnue : consulter le suivi avant toute nouvelle tentative ; ne jamais relancer automatiquement un POST. Les refus amont explicites restent des erreurs connues. Aucun endpoint ne permet de modifier ou supprimer les titres existants.

### Vérifier la disponibilité après l’ajout

`GET /api/agent/media/availability?mediaType=movie&tmdbId=550`

`GET /api/agent/media/availability?mediaType=series&tvdbId=121361`

Seul l’identifiant du type demandé est accepté. La réponse distingue `arr` (state, tracked, item avec hasFile ou compteurs épisodes) et `plex` (state, present, items dans Récap). Correspondance exacte sur identifiants externes (y compris GUID Plex historiques TMDB/TVDB), jamais sur le titre. Si des médias sans identifiant exploitable empêchent de confirmer une absence, Plex devient `unknown` avec `PLEX_IDENTIFIERS_UNAVAILABLE`. `state:"unknown"` et `error.code` indiquent une source non configurée, refusée ou inaccessible ; l’échec d’une source ne devient jamais « absent ». Plex présent pour une série peut ne contenir qu’une partie des épisodes ; les compteurs n’impliquent pas que toute la série soit complète. Réinterroger après acquisition/import Plex.

### Demandes Seerr avec demandeur

`GET /api/agent/seerr/requests?mediaType=movie&status=2&requestedBy=7&offset=0&limit=20`

`GET /api/agent/seerr/requests/42`

Filtres facultatifs : mediaType (movie/series), status (statut demande numérique 1 à 5), requestedBy (ID utilisateur Seerr), offset/limit. La liste expose source, items, pagination et trie par ID ; les filtres précèdent la pagination. Les détails incluent title, IDs externes, requestStatus, mediaStatus, is4k, requestedBy (id/name), dates et saisons (seasonNumber/status). Une valeur inconnue reste null. Pour une demande `is4k:true`, `mediaStatus` utilise exclusivement le statut 4K Seerr (`status4k`) ; si ce statut manque, il reste null, sans reprise du statut standard. Aucun email/token n’est exposé. Ces routes ne créent/modifient aucune demande Seerr ; les vues Seerr et Arr représentent des états distincts.

Erreurs de ces routes : 400 paramètres/choix invalides, 404 ressource absente/hors Récap, 409 service non configuré, 502 source refusée ou réponse inexploitable, 504 délai dépassé. Les erreurs portent un requestId. Les lectures ont un délai global de 15 secondes par session, 4 Mio par réponse et 32 Mio cumulés ; les catalogues trop volumineux ou incohérents sont refusés explicitement.

## Relais générique vers les API natives

`POST /api/agent/relay` est la passerelle générique pour Hermes, sans clé Hermes ni cookie. Whatsarr utilise uniquement le serveur et les identifiants enregistrés dans Paramètres : Hermes ne reçoit pas les clés des services. Contrairement aux routes métier précédentes, le relais accepte les commandes natives de l’API sans catalogue de commandes, normalisation métier ni filtre Récap. Une bibliothèque Plex exclue du Récap reste donc accessible par le relais si le compte Plex l’autorise. Les anciennes routes conservent leurs filtres et contrats.

L’enveloppe comporte `service`, `method`, `path`, puis facultativement `query`, `headers`, `body` et `bodyEncoding`. Aucun autre champ d’enveloppe n’est accepté ; l’intérieur du corps JSON est libre, même un tableau, une chaîne, un nombre, un booléen ou null. Services : `plex`, `radarr`, `sonarr`, `overseerr`, `seerr` (alias d’overseerr), `tautulli`, `tmdb`. Méthodes : GET, HEAD, OPTIONS, POST, PUT, PATCH, DELETE. GET et HEAD n’ont pas de corps.

Hermes construit ses commandes à partir des documentations natives : [Plex Media Server](https://developer.plex.tv/pms/), [Radarr](https://radarr.video/docs/api/), [Sonarr](https://sonarr.tv/docs/api/), [Overseerr / Seerr](https://api-docs.overseerr.dev/), [Tautulli](https://github.com/Tautulli/Tautulli/wiki/Tautulli-API-Reference) et [TMDB](https://developer.themoviedb.org/reference/intro/getting-started). Whatsarr ne maintient pas de liste de commandes pour le relais ; les paramètres nécessaires dépendent de la version du service installé.

Le `path` est le chemin natif absolu, avec la version API requise par le service : `/api/v3/movie` pour Radarr, `/api/v3/series` pour Sonarr, `/api/v1/request` pour Seerr, `/library/sections` pour Plex, `/api/v2` pour Tautulli, `/3/...` ou `/4/...` pour TMDB. Whatsarr ne devine aucune version. Le préfixe du serveur configuré est conservé : serveur `http://radarr:7878/radarr` et path `/api/v3/movie` donnent `http://radarr:7878/radarr/api/v3/movie`. Les paramètres d’URL vont dans `query`, jamais dans `path`. Une URL complète, une autre origine, une traversée `..`, un fragment ou une redirection suivie sont interdits. TMDB utilise toujours `https://api.themoviedb.org`.

```bash
curl -X POST 'http://localhost:3000/api/agent/relay' \
  -H 'Content-Type: application/json' \
  -d '{"service":"radarr","method":"GET","path":"/api/v3/movie","query":{"tmdbId":550}}'
```

`query` accepte des valeurs texte, nombre ou booléen et des tableaux de ces valeurs. Un tableau produit des paramètres répétés, sans changer leur ordre : `{"tag":[1,2]}` produit `tag=1&tag=2`. Les valeurs null ou objets imbriqués sont refusées dans query ; les paramètres métier tels `username` ou `session_id` restent autorisés. `headers` accepte des valeurs texte. Aucun cookie de connexion Whatsarr n’est transféré. Les headers d’authentification, cookies, transport et routage sont réservés : Authorization, X-Api-Key, X-Plex-Token, Host, Content-Length, Connection, Forwarded, etc. Les paramètres d’authentification serveur `apikey`, `api_key` et `X-Plex-Token` sont aussi réservés et ne peuvent pas remplacer les identifiants injectés.

Whatsarr injecte X-Plex-Token pour Plex, X-Api-Key pour Radarr/Sonarr/Seerr, apikey en query pour Tautulli, et Authorization Bearer ou api_key pour une clé TMDB hexadécimale de 32 caractères. Le relais dispose des droits de la clé enregistrée : il permet aussi les modifications et suppressions que l’API native autorise. Les permissions et validations métier restent celles du service.

```json
{
  "service": "sonarr",
  "method": "POST",
  "path": "/api/v3/command",
  "body": {"name": "SeriesSearch", "seriesId": 42}
}
```

`bodyEncoding` vaut `json` par défaut. Avec `text`, body est une chaîne envoyée telle quelle, par exemple du XML. Avec `base64`, body est une chaîne base64 standard avec padding requis si nécessaire ; elle est décodée avant envoi pour transmettre des octets ou du multipart construit par Hermes. Un header Content-Type explicite est respecté, sinon application/json, text/plain ou application/octet-stream est choisi selon l’encodage. Ne pas fournir bodyEncoding en l’absence de body.

```json
{
  "service": "plex",
  "method": "GET",
  "path": "/library/sections",
  "headers": {"Accept": "application/json"}
}
```

Quand le transport aboutit, Whatsarr répond HTTP 200 avec `service`, `upstreamStatus`, `headers`, `body`, `bodyEncoding`, `redacted` et `requestId`. Il faut toujours examiner `upstreamStatus` : un statut natif 400, 401, 404, 422 ou 500 reste une erreur du service, même si le relais répond 200. Une redirection native 3xx est rendue sans être suivie. Les réponses 204/304, HEAD ou corps vide sont rendues avec body null et bodyEncoding `empty` ; JSON natif donne `json`, texte/XML donne `text`, octets donnent `base64`. Un JSON amont malformé mais décodable en UTF-8 est rendu en texte. Le texte/XML utilise le charset déclaré (UTF-8 par défaut). Un charset inconnu ou des octets invalides pour cet encodage produisent une réponse base64 pour conserver les octets, après vérification des identifiants connus. Les headers utiles tels Content-Type, Location et Retry-After sont conservés ; les cookies, identifiants et headers de transport sont retirés.

```json
{
  "service": "radarr",
  "upstreamStatus": 200,
  "headers": {"content-type": "application/json"},
  "body": [{"id":42,"title":"Exemple","hasFile":true}],
  "bodyEncoding": "json",
  "redacted": false,
  "requestId": "identifiant-de-correlation"
}
```

Les clés enregistrées de tous les services (y compris leurs formes sans préfixe Bearer), leurs représentations encodées et les champs explicitement sensibles (apiKey, password, Authorization…) sont occultés dans les sorties JSON, texte, XML et headers : `redacted` devient true. Les champs métier tels ratingKey, username, session_id ou request_token restent utilisables si leur valeur ne contient pas une clé ou un mot de passe configuré. Les échappements URL mixtes et les entités XML numériques ou nommées sont pris en compte ; une valeur numérique ou booléenne JSON reflétant une clé est aussi occultée. Un binaire contenant un identifiant connu est refusé avec RELAY_SECRET_IN_BINARY plutôt que modifié. Aucun payload ou URL authentifiée n’est journalisé par le relais.

Les erreurs propres à Whatsarr gardent le format `{"error":{"code":"…","message":"…","requestId":"…"}}` : 400 AGENT_INVALID_REQUEST pour une enveloppe invalide, 409 RELAY_NOT_CONFIGURED si le service manque d’URL/clé, 413 AGENT_INVALID_REQUEST si la requête dépasse la limite, 413 RELAY_RESPONSE_TOO_LARGE si la réponse dépasse la limite, 502 RELAY_UPSTREAM_ERROR pour une rupture réseau, 502 RELAY_SECRET_IN_BINARY et 504 RELAY_TIMEOUT. Après un délai ou une rupture lors d’une écriture, le service peut avoir appliqué l’action : consulter son état avant toute nouvelle demande. Whatsarr ne répète jamais automatiquement un appel, ne pagine pas et ne déduplique pas pour Hermes.

Les plafonds configurables sont `RELAY_MAX_REQUEST_BYTES` (10 Mio pour l’enveloppe JSON entière, donc tenir compte de l’expansion base64), `RELAY_MAX_RESPONSE_BYTES` (32 Mio d’octets amont décompressés) et `RELAY_TIMEOUT_MS` (30 000 ms, lecture du corps comprise). Les anciennes routes gardent leur limite JSON de 100 Kio. Le relais ne fournit pas de WebSocket ni de SSE infini. Pour une tâche longue, lancer la commande native puis interroger son statut avec d’autres appels.

## Vérifications de développement

Les tests automatisés couvrent HTTP NestJS, concurrence/persistance SQLite, worker, downloader, clients de médias et affichage des identifiants. Les envois et sources externes sont contrôlés ; aucun message de test n'est publié au groupe réel.

```bash
pnpm --filter @whatsarr/api test
pnpm --filter @whatsarr/web test
pnpm --filter @whatsarr/api lint
pnpm --filter @whatsarr/web lint
pnpm --filter @whatsarr/shared build
pnpm --filter @whatsarr/api build
pnpm --filter @whatsarr/web build
node apps/api/scripts/hermes-smoke.cjs
```

Le smoke charge les modules compilés, emploie une base temporaire et remplace seulement le transport WhatsApp. Il vérifie les routes, erreurs, protection admin et égalité du contrat embarqué avec le JSON. Après installation/rebuild de Whatsarr, vérifier les lectures contre Plex/Tautulli réels, puis publier un message de validation voulu avec un messageId neuf. Cette implémentation n'a pas encore été testée contre les services réels.
