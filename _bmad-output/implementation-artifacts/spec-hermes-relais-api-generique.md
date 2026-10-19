---
title: 'Hermes : relais générique vers les API des services configurés'
type: 'feature'
created: '2026-10-19'
status: 'done'
baseline_commit: 'fae99fd34df7944e53be02eb4759bde5453eca5d'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hermes doit choisir librement la commande native ; Whatsarr fournit les identifiants sans les communiquer.

**Approach:** POST `/api/agent/relay` transmet service, méthode, chemin et paramètres, puis rend la réponse. Toutes les actions HTTP permises par la clé sont utilisables, sans code par commande.

## Boundaries & Constraints

**Always:** Cible des Paramètres. Aucun catalogue, filtre Récap ni validation métier. Clés injectées côté serveur et masquées en sortie/logs. Hermes local sans clé/cookie. Anciennes routes conservées.

**Ask First:** Exécuter volontairement des mutations sur les services réels, publier une PR ou déployer demande une instruction distincte.

**Never:** Cible arbitraire, remplacement de l’auth injectée, redirection suivie, répétition automatique. Aucun ajout, téléchargement, message ou mutation réel en test.

## I/O & Edge-Case Matrix

| Cas | Entrée | Résultat | Erreur |
|---|---|---|---|
| Lecture/écriture | commande native valide | même méthode, paramètres et corps, authentification du service | réponse amont conservée |
| Nouvelle commande | endpoint absent du code Whatsarr | transmis sans ajout au catalogue | validation native du service |
| Source absente | service configuré sans clé/URL | aucun appel | 409 |
| Auth redéfinie/cible détournée | URL, traversal, auth réservée | refus avant transport | 400 |
| Erreur métier | 4xx/5xx du service | statut/corps amont dans enveloppe | pas de succès métier inventé |
| Secret rendu | configuration amont, erreur ou header avec clé | occultation signalée ; binaire secret refusé | aucune clé révélée |
| Corps/réseau | vide, JSON, XML, texte, binaire | encodage explicite ; timeout/limite explicites | pas de replay automatique |

</frozen-after-approval>

## Code Map

Chemins agent/ relatifs à `apps/api/src/modules/`. SettingsService fournit six services. Garder AgentSourceSession métier séparé ; il impose GET/POST JSON. Main configure les parseurs ; le web embarque le guide.

## Tasks & Acceptance

**Execution:**
- [x] `agent/agent-relay.dto.ts` — contrat strict en enveloppe, libre à l’intérieur : service, method, path, query, headers, body, bodyEncoding. Services plex/radarr/sonarr/overseerr/tautulli/tmdb, alias seerr ; GET/HEAD/OPTIONS/POST/PUT/PATCH/DELETE. GET/HEAD sans corps. Query scalaire/tableau répété ; noms natifs libres ; body JSON quelconque, texte ou base64. Refuser champs inconnus et headers transport/auth réservés.
- [x] `agent/agent-relay.service.ts` — transporter vers le serveur enregistré, en préservant son préfixe URL ; path natif sans version API ajoutée. TMDB sur api.themoviedb.org (/3 ou /4). Vérifier origine/préfixe après décodage ; zéro redirection.
- [x] Même service — injecter X-Api-Key pour Arr/Seerr, X-Plex-Token pour Plex, apikey query pour Tautulli, Bearer ou api_key pour TMDB. Refuser toute auth contradictoire. Aucun retry, pagination ou déduplication automatique.
- [x] `agent/agent-relay-redaction.ts` — occulter secrets configurés bruts/encodés, champs sensibles JSON, headers auth/cookies et secrets dans texte/XML. Ne pas supprimer les champs métier tels ratingKey. redacted=true ; binaire avec secret connu refusé. Pas de payload/URL authentifiée en log.
- [x] `agent/agent-relay.controller.ts`, `agent/agent.module.ts` — POST relay ; réponse HTTP 200 si transport abouti : service, upstreamStatus, headers utiles, body, bodyEncoding, redacted, requestId. Statut natif conservé, même 204/304/3xx/4xx/5xx ; vide=null. Erreurs du relais au format AgentError 400/409/413/502/504. Aucun cookie administrateur transféré implicitement.
- [x] `apps/api/src/main.ts`, `agent-exception.filter.ts` — parseur propre au relais avant le parseur par défaut, corrélation maintenue. Limites explicites configurables : requête 10 Mio, réponse 32 Mio, délai 30s par défaut (RELAY_MAX_REQUEST_BYTES, RELAY_MAX_RESPONSE_BYTES, RELAY_TIMEOUT_MS). Anciennes limites conservées. Sans WebSocket/SSE infini ; tâches longues lancées puis interrogées nativement.
- [x] Tests `agent-relay*.spec.ts` — matrice, méthodes/auth, préfixes, query répétée, encodages, réponses vides, limites/délais, secrets réfléchis et aucun second POST ; sources simulées.
- [x] `docs/hermes-agent.md`, `docs/hermes-agent.openapi.json`, `agent/hermes-openapi.ts` — contrat, encodages, erreurs natives, auth et exemples. Distinguer relais/anciennes routes ; placer avant Vérifications de développement.
- [x] `apps/web/src/HermesPage.tsx`, `apps/web/src/HermesPage.spec.tsx`, `apps/web/vite.config.ts`, `apps/api/scripts/hermes-smoke.cjs` — adresse copiable du relais, capacité générique, validation du guide et test DI sans mutation.

**Acceptance Criteria:**
- Given une API configurée, when Hermes appelle un endpoint non recensé, then Whatsarr transmet sans connaître cette commande.
- Given un appel au relais Plex, when une bibliothèque n’est pas Récap, then seul Plex décide de l’accès.
- Given une erreur métier ou réponse sans corps, when le relais répond, then le statut natif reste identifiable.
- Given les clés stockées, when Hermes lit une réponse ou un log, then aucune clé injectée n’est rendue.
- Given les anciennes routes, when leurs tests s’exécutent, then leur comportement reste compatible.

## Spec Change Log

## Verification

- Tests API/web, lint et builds : export propre des fichiers maintenus, doublons locaux préservés.
- Smoke AppModule/OpenAPI/base temporaire : aucune mutation externe réelle.

### Résultats de l’implémentation

- Export propre des fichiers suivis et des nouveaux fichiers du relais, sans les doublons locaux : 485 tests API (dont 120 tests HTTP du relais) et 5 tests web réussis.
- Vérification TypeScript API et compilations API/web réussies sur cet export.
- Smoke AppModule réel : injection des dépendances, OpenAPI empaqueté identique au JSON documenté, configuration absente en 409, parseur relais >100 Kio, authentification administrateur conservée et base SQLite temporaire. Aucun appel aux services réels ni envoi WhatsApp.
- Le relais accepte les commandes natives non recensées et conserve les paramètres métier (session_id, request_token, username…), tout en réservant les identifiants serveur et les headers de transport. Les anciennes routes Plex restent filtrées Récap ; le relais n’applique pas ce filtre.
- Aucun commit, publication, déploiement ni mutation externe réalisé dans cette étape d’implémentation.

### Corrections ciblées après revue

- Occultation des échappements URL mixtes, des entités XML numériques/nommées et des valeurs numériques/booléennes JSON reflétant une clé ; valeurs Authorization/Cookie complètes masquées.
- Normalisation des clés de tous les services pour protéger aussi les tokens sans leur préfixe Bearer.
- Charset déclaré respecté pour les textes ; octets invalides ou charset inconnu conservés en base64 après contrôle des secrets.
- Pourcent littéral encodé accepté dans les chemins natifs, sans autoriser les traversées voisines ou doublement encodées.

## Suggested Review Order

**Contrat et transport**

- Point unique du relais et enveloppe de réponse.
  [agent-relay.controller.ts:7](../../apps/api/src/modules/agent/agent-relay.controller.ts#L7)

- Valide le transport sans catalogue de commandes métier.
  [agent-relay.dto.ts:1](../../apps/api/src/modules/agent/agent-relay.dto.ts#L1)

- Injecte les clés et conserve méthode, statut et contenu natifs.
  [agent-relay.service.ts:44](../../apps/api/src/modules/agent/agent-relay.service.ts#L44)

**Confidentialité et compatibilité**

- Masque les clés réfléchies et leurs représentations encodées.
  [agent-relay-redaction.ts:21](../../apps/api/src/modules/agent/agent-relay-redaction.ts#L21)

- Réserve le parseur élargi au relais, avec corrélation.
  [agent-exception.filter.ts:33](../../apps/api/src/modules/agent/agent-exception.filter.ts#L33)

**Documentation et tests**

- Exemples, droits natifs et limites techniques configurables.
  [hermes-agent.md:240](../../docs/hermes-agent.md#L240)

- Vérifie méthodes, erreurs, encodages, confidentialité et compatibilité HTTP.
  [agent-relay.controller.spec.ts:1](../../apps/api/src/modules/agent/agent-relay.controller.spec.ts#L1)
