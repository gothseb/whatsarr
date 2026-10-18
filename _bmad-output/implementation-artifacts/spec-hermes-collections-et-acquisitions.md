---
title: 'Hermes : collections Plex, suivi Seerr et acquisitions Radarr/Sonarr'
type: 'feature'
created: '2026-10-18'
status: 'done'
baseline_commit: 'd3da1c9dca00f3a8eedc2ef994a2275887812349'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hermes doit consulter collections Plex, suivi/tags Arr et demandes Seerr avec demandeur (les deux vues confirmées).

**Approach:** Étendre l’API Hermes et sa documentation : lectures, ajouts directs Radarr/Sonarr et vérification de disponibilité.

## Boundaries & Constraints

**Always:** Réutiliser URL/secrets des Paramètres, sans clé Hermes. Collections limitées à Récap. Distinguer demande, suivi et disponibilité. Validation stricte, lectures/délais bornés, logs requestId sans secrets.

**Ask First:** Toute extension aux suppressions/modifications de titres existants.

**Never:** Écrire dans Plex/Seerr, modifier/supprimer un titre existant, exposer un proxy arbitraire. Aucun ajout/téléchargement/message réel en test. Préserver les fichiers étrangers au chantier.

## I/O & Edge-Case Matrix

| Situation | Entrée | Comportement attendu | Erreur |
|---|---|---|---|
| Collections | bibliothèque Récap | liste et contenu paginés | aucune sélection : liste vide |
| Hors périmètre | collection/bibliothèque exclue | aucun contenu rendu ni catalogue exclu consulté | 404 |
| Suivi Arr | filtre titre/tag, pagination | titres, identifiants, suivi, présence fichiers, tags ID/libellé | paramètres invalides : 400 |
| Demandes Seerr | type/statut/demandeur, pagination | ID, titre, type, statuts demande/média, demandeur ID/nom, dates et saisons | valeurs inconnues : null |
| Ajout | identifiant externe, profil, dossier, tags | validation puis création ; métadonnées issues du lookup | configuration/choix invalides explicites |
| Disponibilité | identifiant TMDB/TVDB exact | suivi Arr, fichiers et présence Plex distincts ; séries : nombre d’épisodes présents | source en échec : état inconnu explicite, jamais absent |
| Déjà suivi | même identifiant externe | titre existant, deduplicated:true ; aucun changement | concurrence : relire avant conclusion |
| Réseau après POST | délai ou résultat incertain | état incertain explicite ; relire avant répétition | aucun retry aveugle |
| Source indisponible | clé absente/refusée, timeout, corps invalide | erreur agent avec requestId | 409/502/504, sans corps amont |

</frozen-after-approval>

## Code Map

Chemins agent/ et plex/ relatifs à `apps/api/src/modules/`. SettingsService : secrets ; MonthlyRecapLibrary.included : Récap ; NotificationsService : logs.

## Tasks & Acceptance

**Execution:**
- [x] `plex/plex-collections.ts`, `plex/plex.service.ts` — lister les collections via sections autorisées et vérifier leur appartenance avant lecture des éléments.
- [x] `agent/agent-collections.controller.ts`, `agent/agent-media.dto.ts`, `agent/agent.service.ts` — GET `media/collections` et `media/collections/:id/items`, libraryKey/q, offset/limit, tri stable.
- [x] `agent/agent-arr.service.ts`, `agent/agent-arr.controller.ts`, `agent/agent-arr.dto.ts` — GET `radarr/movies`, `sonarr/series`, `lookup`, `tags`, `options` par source (profils/dossiers). Filtres q/tagId/monitored, pagination 20–100.
- [x] `agent/agent-arr.service.ts` et contrôleur associé — POST `radarr/movies` avec tmdbId ou `sonarr/series` avec tvdbId ; qualityProfileId/rootFolderId obligatoires, tagIds facultatifs, monitored=true, search=false par défaut. seasonNumbers facultatif (défaut hors spéciaux). Valider les choix amont ; 201 créé ou 200 existant inchangé. Suivi autorise acquisitions futures ; search déclenche la recherche immédiate. Un échec de log ne redéclenche pas l’ajout.
- [x] `agent/agent-availability.service.ts`, `agent/agent-collections.controller.ts`, `plex/plex-catalogue.ts` — GET `media/availability` par type et tmdbId (film) ou tvdbId (série) ; correspondance par identifiants externes, jamais titre seul. Séparer suivi, fichiers Arr et présence Plex dans les bibliothèques Récap ; reconsultation après ajout, erreur/inconnu par source.
- [x] `agent/agent-requests.service.ts`, `agent/agent-requests.controller.ts` — GET `seerr/requests` et `seerr/requests/:id` ; réglage overseerr ; demandes/détails, sans email/token ni demandeur inventé.
- [x] `agent/agent-source.ts`, `agent/agent.module.ts` — câbler routes/sources et POST bornés ; préserver les lectures existantes.
- [x] Tests `.spec.ts` colocalisés — matrice, choix invalides, tags, concurrence, timeout après POST, pagination et isolement des bibliothèques ; sources simulées.
- [x] `docs/hermes-agent.md`, `docs/hermes-agent.openapi.json`, `agent/hermes-openapi.ts` — synchroniser contrats, erreurs et exemples.
- [x] `apps/web/src/HermesPage.tsx`, `apps/web/src/HermesPage.spec.tsx`, `apps/web/vite.config.ts`, `apps/api/scripts/hermes-smoke.cjs` — capacités/liens, documentation embarquée, DI/routes sans écriture réelle.

**Acceptance Criteria:**
- Given une bibliothèque exclue, when Hermes lit une collection, then aucun élément exclu n’est révélé.
- Given les services configurés, when Hermes consulte les deux vues, then il distingue demandeur/statut Seerr et suivi/tags Arr.
- Given un titre absent, when Hermes ajoute puis vérifie, then un seul titre est suivi et sa disponibilité réelle est distincte ; une série partielle ne devient pas complète.
- Given `/hermes-doc`, when le lecteur suit les exemples, then origine réelle et effets des ajouts sont explicites.

## Spec Change Log

## Design Notes

API v3 Arr, X-Api-Key serveur. Arr/Seerr sans filtre Récap ; pas de nouvel écran ni déploiement/PR.

## Verification

- `pnpm --filter @whatsarr/api test` et `pnpm --filter @whatsarr/web test` : sources simulées.
- `pnpm lint` et `pnpm build` sur checkout propre ; préserver les doublons `* 2.ts`.
- `node apps/api/scripts/hermes-smoke.cjs` : DI réelle, SQLite temporaire, OpenAPI conforme, zéro écriture Arr réelle.

Sources : contrats officiels Radarr/Sonarr, Seerr et Plex PMS vérifiés.

## Implementation self-check (step 03)

Implémentation exécutée sans ajout réel, sans envoi WhatsApp et sans déploiement. API collections Plex (`/items` confirmé dans le contrat PMS officiel), suivi et ajouts Arr, demandes Seerr et disponibilité par identifiants exacts câblés. Sélection Récap appliquée avant les lectures de contenu Plex ; hoisting librarySectionID accepté, contradictions rejetées. Les saisons Sonarr transmises sont conservées via addOptions.monitor=skip.

Les ajouts restent strictement create-only : choix vérifiés, métadonnées reconstruites, titre existant inchangé, verrou local par source/ID, réconciliation lors de conflit ou issue réseau inconnue, jamais de second POST automatique. Les logs ne peuvent répéter l’écriture.

Vérification : 343 tests API maintenus passés avant les deux derniers cas Plex ajoutés ; vérification finale ci-dessous dans le bilan agent. Les cinq tests web, compilation des sources maintenues, bundle web et smoke AppModule/SQLite temporaire ont passé. Les doublons locaux étrangers * 2.ts empêchent le build brut ; configuration temporaire excluant uniquement ces doublons utilisée, aucun fichier étranger supprimé. Documentation embarquée vérifiée en HTML et OpenAPI synchronisé.

Limites : catalogues bornés (4 Mio/réponse, 32 Mio/session, 15 secondes ; maximum 20 000 lignes/pages bornées) ; une source défaillante devient unknown, jamais absent. La disponibilité est une nouvelle lecture distincte, sans promesse d’acquisition immédiate ; une série Plex présente peut être partielle. Aucun accès réseau aux serveurs de l’utilisateur pour valider des écritures.

## Corrections de revue étape 04

Validation stricte des catalogues Arr avant déduction d’absence ou ajout ; IDs de tags/options normalisés et objets amont refusés. Découverte Plex invalide refusée, GUID historiques TMDB/TVDB reconnus ; une absence non vérifiable devient unknown. Les demandes Seerr exposent is4k et utilisent exclusivement status4k pour une demande 4K. Après l’échec connu d’un ajout concurrent, la requête suivante traite ses propres choix ; une issue POST incertaine bloque toute répétition automatique. Schéma OpenAPI item nullable inline compatible OAS 3. Régressions ciblées ajoutées ; bloc frozen préservé.

Vérification finale après corrections de revue : 82 tests ciblés API (47 acquisitions, 21 HTTP, 14 Plex) et 5 tests web passent. TypeScript maintenu (sources et tests), compilation API hors doublons étrangers, bundle web, smoke production AppModule/SQLite temporaire et git diff --check passent. Aucun appel d’ajout réel, aucune publication ni commit.

Compatibilité Plex : lecture canonique `/library/metadata/:id/children` (sans mutation), acceptation des listes de collections Directory ou Metadata ; régression dédiée.

## Validation finale

365 tests API (25 suites) et 5 tests web passent. Export propre : commandes standard API lint/build/test, build web et smoke AppModule/SQLite temporaire valides. Doublons locaux preserves. Revue a trois lectures et regressions validees ; aucune mutation sur les services reels.

## Suggested Review Order

**Routes et ajouts**

- Routes et statuts HTTP.
  [agent-arr.controller.ts:9](../../apps/api/src/modules/agent/agent-arr.controller.ts#L9)

- Ajouts, doublons et resultats incertains.
  [agent-arr.service.ts:91](../../apps/api/src/modules/agent/agent-arr.service.ts#L91)

**Disponibilite et perimetre**

- Suivi, fichiers et Plex distincts.
  [agent-availability.service.ts:7](../../apps/api/src/modules/agent/agent-availability.service.ts#L7)

- Collections limitees aux bibliotheques autorisees.
  [plex-collections.ts:11](../../apps/api/src/modules/plex/plex-collections.ts#L11)

**Demandes et documentation**

- Demandeurs et statuts Seerr, distinction 4K.
  [agent-requests.service.ts:9](../../apps/api/src/modules/agent/agent-requests.service.ts#L9)

- Exemples et effets des ajouts.
  [hermes-agent.md:178](../../docs/hermes-agent.md#L178)

**Verification**

- Ajouts, concurrence et validation amont.
  [agent-acquisitions.spec.ts:1](../../apps/api/src/modules/agent/agent-acquisitions.spec.ts#L1)

- Pagination, compatibilite et confidentialite.
  [plex-collections.spec.ts:1](../../apps/api/src/modules/plex/plex-collections.spec.ts#L1)
