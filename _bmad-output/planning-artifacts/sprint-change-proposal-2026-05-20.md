# Sprint Change Proposal: source de verite media

Date: 2026-05-20
Status: applied
Requested by: Seb

## 1. Change Summary

La source de verite des disponibilites media n'est plus "Plex principalement" pour tous les cas.

Nouvelle regle:

- Overseerr est la source de verite pour les films et la premiere saison d'une serie.
- Plex est la source de verite pour le ou les premiers episodes des saisons suivantes, a partir de la saison 2.
- Plex est aussi la source de verite pour les nouveaux episodes d'une saison en cours, car Overseerr ne suit pas les ajouts episode par episode ni les nouvelles saisons.
- Les messages individuels suivent la meme logique, avec Overseerr conserve pour relier demandes/demandeurs/suivis quand utile.

## 2. Impact Analysis

Impact produit:

- Le brief et le PRD devaient remplacer la formulation "Plex source principale" par un routage explicite.
- FR-10, FR-14 et FR-15 sont impactees.
- Les annonces groupe doivent consommer un evenement de disponibilite deja route, pas une detection Plex brute.

Impact architecture:

- Le backend doit contenir un routeur de source de verite media.
- Les events externes `overseerr.request.available` et `plex.media.available` doivent etre normalises vers un evenement interne route, par exemple `media.availability.routed`.
- L'outbox et les notifications ne doivent pas reimplementer cette decision de source.

Impact stories:

- Story 4.4 devient le point central du routage source de verite.
- Story 4.7 publie uniquement des contenus deja routes.
- Story 4.8 precise Overseerr pour films/saison 1 et Plex pour saisons 2+/episodes.
- Story 4.9 precise Plex comme source obligatoire pour les nouveaux episodes.

## 3. Applied Document Updates

- `_bmad-output/planning-artifacts/briefs/brief-whatsarr-2026-05-19/brief.md`
- `_bmad-output/planning-artifacts/briefs/brief-whatsarr-2026-05-19/addendum.md`
- `_bmad-output/planning-artifacts/briefs/brief-whatsarr-2026-05-19/.decision-log.md`
- `_bmad-output/planning-artifacts/prds/prd-whatsarr-2026-05-19/prd.md`
- `_bmad-output/planning-artifacts/prds/prd-whatsarr-2026-05-19/addendum.md`
- `_bmad-output/planning-artifacts/prds/prd-whatsarr-2026-05-19/.decision-log.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/implementation-artifacts/4-4-detecter-les-nouvelles-disponibilites-plex.md`
- `_bmad-output/implementation-artifacts/4-7-publier-les-annonces-groupe-de-nouveautes.md`
- `_bmad-output/implementation-artifacts/4-8-detecter-et-notifier-une-demande-disponible.md`
- `_bmad-output/implementation-artifacts/4-9-detecter-et-notifier-les-nouveaux-episodes.md`

## 4. Handoff Notes For Implementation

- Garder les statuts sprint existants; aucune story n'est repassee en backlog.
- Ne pas renommer le fichier de story 4.4 pour eviter de casser la cle `sprint-status.yaml`.
- Implementer d'abord le routeur source de verite dans Story 4.4 avant Story 4.7, 4.8 et 4.9.
- Journaliser pour chaque decision la source retenue: `overseerr` ou `plex`.
- Les cles anti-doublon doivent tenir compte du niveau annonce: contenu pour film/saison 1, serie+saison pour nouvelle saison, episode pour notification individuelle.
