# Addendum: PRD whatsarr

## Sources d'entree

- Brief produit: `_bmad-output/planning-artifacts/briefs/brief-whatsarr-2026-05-19/brief.md`
- Notes de decouverte: `_bmad-output/planning-artifacts/briefs/brief-whatsarr-2026-05-19/addendum.md`
- Decisions produit: `_bmad-output/planning-artifacts/briefs/brief-whatsarr-2026-05-19/.decision-log.md`

## Notes techniques a pousser vers architecture

- WhatsApp doit etre pilote comme WhatsApp Web, sans API Meta Business et sans dependance obligatoire a WAHA.
- Le composant WhatsApp doit etre isole derriere une interface interne pour limiter l'impact des changements de librairie.
- Les secrets services doivent etre stockes proprement et masques dans l'interface.
- Une table d'historique anti-doublon sera probablement necessaire pour les annonces, notifications individuelles et recaps mensuels.
- Les metadonnees TMDB doivent inclure attribution dans l'application.
- Le recap mensuel exige une definition precise de "vu": lecture complete, scrobble, seuil Tautulli, ou historique Plex.

## Correction produit du 2026-05-20

- Les annonces groupe ne doivent plus considerer Plex comme source unique de disponibilite.
- Overseerr est la source de verite pour les films et la premiere saison d'une serie.
- Plex est la source de verite pour le ou les premiers episodes des saisons suivantes, a partir de la saison 2.
- Les notifications individuelles suivent ce routage, avec une precision importante: les nouveaux episodes d'une saison en cours et les nouvelles saisons sont detectes via Plex, car Overseerr ne suit pas les ajouts d'episodes individuels ni les nouvelles saisons.
- Les stories FR10, FR14 et FR15 doivent donc implementer un routeur de source de verite et journaliser la source retenue.

## Sources web verifiees pendant le brief

- WAHA documente les sessions WhatsApp, QR code, restart/logout et stockage de session.
- Overseerr supporte les notifications Webhook avec payload JSON personnalisable.
- Plex expose des webhooks comme `library.new`, mais les webhooks Plex demandent Plex Pass.
- Tautulli supporte les agents de notification et les webhooks, avec triggers lies aux contenus ajoutes et a l'activite.
- TMDB expose recherche, details, dates de sortie, traductions, images et IDs externes; attribution requise.
