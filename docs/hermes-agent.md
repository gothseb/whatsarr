# Hermes et Whatsarr sur le réseau local

L'agent appelle Whatsarr sur `http://IP_WHATSARR:3000/api/agent`, sans clé Hermes ni cookie, même lorsque l'interface administrateur exige une connexion. Whatsarr utilise sa session WhatsApp et son groupe serveur configuré. Hermes rédige les news et conseils et gère leur calendrier.

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

## Rechercher dans Plex

```bash
curl 'http://localhost:3000/api/agent/media/search?q=Alien&mediaType=movie&offset=0&limit=20'
```

Films et séries disponibles dans les bibliothèques Plex (`movie` et `series`). `q` obligatoire, trimé, 1–200 unités UTF-16 ; titre contenant q sans distinction de casse. Filtres facultatifs libraryKey et mediaType, offset >=0, limit 1–100 (défaut 20). Les types répétés/tableaux, paramètres inconnus et nombres ambigus sont refusés. Les métadonnées publiques sont ratingKey, libraryKey, title, mediaType, year, summary, genres, addedAt ; les champs facultatifs absents restent null/genres []. Aucun token, chemin vidéo ou URL authentifiée.

La réponse est `{ items, pagination: { offset, limit, hasMore }, source: "plex" }`. Bibliothèque inexistante : 404 PLEX_LIBRARY_NOT_FOUND ; bibliothèque existante sans correspondance : 200 vide. Source non configurée : 409 PLEX_NOT_CONFIGURED ; refus des identifiants : 502 PLEX_AUTHENTICATION_ERROR ; réseau/corps/pagination invalide : 502 PLEX_UNREACHABLE ; délai total dépassé : 504 PLEX_TIMEOUT. Ces lectures fonctionnent sans groupe ni session WhatsApp et ne créent aucun job.

La V1 vérifie le titre côté client sur des pages de catalogue, sans dépendre d’un hub limité ou d’un filtre approximatif. Tri titre sans casse, libraryKey, ratingKey ; déduplication par bibliothèque/identifiant avant pagination. Le catalogue est vivant : l’offset peut bouger entre appels. Budget total 15s, 4 Mio par corps, 32 Mio cumulés, 20 000 lignes amont et 200 pages par section maximum. Si ces limites empêchent une réponse complète, la route retourne une erreur explicite ; aucun résultat partiel trompeur. Aucun SDK ni changement du client historique d’import JSON/XML.

Références serveur : [API Plex officielle](https://developer.plex.tv/pms/), [commandes URL Plex](https://support.plex.tv/articles/201638786-plex-media-server-url-commands/). Le token configuré est transmis uniquement au serveur par header ; les redirections sont refusées.

## Derniers ajouts Plex

```bash
curl 'http://localhost:3000/api/agent/media/recent?mediaType=episode&offset=0&limit=20'
```

Filtres facultatifs libraryKey et mediaType (movie/series/episode) ; pagination et erreurs identiques à search. Sans type, inclure les trois catégories, sans saisons/collections. Tri global addedAt décroissant puis libraryKey/ratingKey ; dates manquantes en fin. La réponse ajoute releaseDate (date civile YYYY-MM-DD), seriesTitle, seasonNumber et episodeNumber (null hors épisode). Saison/épisode zéro sont conservés.

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

Hermes peut donc lire search/recent/watch-history, rédiger ses news ou conseils, puis envoyer un POST messages et suivre le job. Whatsarr ne génère ni ne planifie les conseils à sa place.

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
