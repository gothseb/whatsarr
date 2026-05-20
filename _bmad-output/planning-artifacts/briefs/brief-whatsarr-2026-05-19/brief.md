---
title: "Product Brief: whatsarr"
status: draft
created: 2026-05-19
updated: 2026-05-20
---

# Product Brief: whatsarr

## Executive Summary

Whatsarr est une application auto-hebergee, installable en Docker, concue pour un usage personnel et pour s'integrer a l'ecosysteme d'un serveur multimedia Plex au meme titre que Radarr, Sonarr, Overseerr ou Tautulli. Elle centralise les connexions vers Plex, Radarr, Sonarr, Overseerr, Tautulli, TMDB et WhatsApp afin d'automatiser les annonces et notifications autour des contenus disponibles.

Le produit doit permettre a l'administrateur du serveur Plex de renseigner les URL et cles d'acces de ses services media, de connecter son propre compte WhatsApp via une session WhatsApp Web pilotee par l'application, de selectionner un groupe WhatsApp dedie au serveur, de rapprocher les contacts WhatsApp des utilisateurs Plex, puis d'envoyer automatiquement des messages riches: annonces de nouveaux films/series disponibles, notifications individuelles quand une demande est disponible, alertes d'episodes pour les spectateurs concernes, et recap mensuel des contenus les plus vus.

## The Problem

Les administrateurs Plex qui gerent une communaute d'utilisateurs doivent souvent annoncer manuellement les nouveautes, repondre aux demandes terminees, et prevenir les personnes interessees par une serie. Les outils existants du stack media savent detecter les evenements, mais ils ne parlent pas naturellement dans le canal ou se trouvent deja les utilisateurs: WhatsApp.

Le cout du statu quo est une communication manuelle, incomplete ou tardive: les utilisateurs ne savent pas toujours qu'une demande est disponible, les nouveautes recentes ne sont pas valorisees avec de bons visuels, et l'administrateur repete des messages qui pourraient etre automatises.

## The Solution

Whatsarr agit comme une passerelle de notification media vers WhatsApp. L'administrateur configure les services media depuis une page Parametres, ajoute les URL et cles API de Plex, Radarr, Sonarr, Overseerr, Tautulli et TMDB, puis connecte une session WhatsApp Web locale comme si l'application etait un navigateur. L'application conserve cette session dans son stockage persistant, liste les groupes WhatsApp disponibles, permet de choisir le groupe du serveur, puis mappe les contacts WhatsApp avec les utilisateurs Plex.

Whatsarr applique un routage explicite des sources de verite. Overseerr est la source de verite pour les films disponibles et pour la premiere saison d'une serie. Plex est la source de verite pour les premiers episodes des saisons suivantes, a partir de la saison 2, et pour les nouveaux episodes ajoutes dans une saison en cours, car Overseerr ne suit pas finement ces ajouts episode par episode. L'application genere ensuite des publications de groupe pour les nouveautes recentes et des messages individuels pour les evenements personnels: demande disponible, nouvelle saison, nouvel episode arrive, ou autre signal pertinent issu de Plex/Tautulli/Overseerr selon le cas.

## What Makes This Different

Le differenciateur principal est l'orientation WhatsApp pour les serveurs Plex prives. La plupart des outils de notification media couvrent Discord, Telegram, email ou webhooks generiques; Whatsarr vise les usages ou la communaute du serveur existe deja dans WhatsApp.

Le produit doit ressembler aux apps self-hosted de l'ecosysteme Arr: installation Docker simple, interface web d'administration, connexions API explicites, persistance de configuration, logs lisibles, et comportement fiable apres redemarrage.

Le choix de ne pas utiliser l'API Meta WhatsApp Business est volontaire: Whatsarr doit piloter une session WhatsApp Web personnelle pour pouvoir publier dans un groupe existant et parler avec le compte de l'administrateur.

## Who This Serves

Utilisateur principal: l'administrateur unique d'un serveur Plex personnel partage avec famille, amis ou communaute privee, qui utilise deja Radarr, Sonarr, Overseerr et/ou Tautulli.

Utilisateurs indirects: les membres Plex associes a un ou plusieurs contacts WhatsApp, qui recoivent des annonces de groupe et des messages individuels lies a leurs demandes ou habitudes de visionnage.

## Success Criteria

- Installer l'application via Docker et conserver les donnees apres redemarrage.
- Connecter les services Plex, Radarr, Sonarr, Overseerr, Tautulli, TMDB et WhatsApp.
- Configurer les URL et cles d'acces des services depuis une page Parametres.
- Garder une session WhatsApp Web active entre redemarrages Docker.
- Lister les groupes WhatsApp du compte connecte.
- Selectionner un groupe WhatsApp et recuperer ses contacts.
- Mapper un utilisateur Plex vers un ou plusieurs contacts WhatsApp.
- Publier automatiquement une annonce de groupe pour un film ou une serie recentement disponible.
- Envoyer un message individuel lorsqu'une demande utilisateur est disponible.
- Envoyer un message individuel aux spectateurs pertinents lorsqu'un nouvel episode arrive, en ciblant a la fois les personnes qui ont regarde la serie et celles qui l'ont demandee/suivie.
- Envoyer chaque premier du mois un recap unique regroupant films et series les plus vus, classe par nombre d'utilisateurs distincts.
- Permettre de choisir les bibliotheques/dossiers Plex inclus dans le recap mensuel.
- Permettre de personnaliser les textes types des differents messages automatiques.

## Scope

Premiere version:

- Interface web d'administration.
- Deploiement Docker avec stockage persistant.
- Connexion et test des integrations principales.
- Page Parametres pour URL et cles API des services media.
- Une seule session WhatsApp Web pilotee par l'application, sans API Meta.
- Persistance de la session WhatsApp apres redemarrage Docker.
- Liste des groupes WhatsApp du compte connecte.
- Selection du groupe WhatsApp serveur.
- Import des contacts du groupe.
- Mapping contacts WhatsApp vers utilisateurs Plex, avec support de plusieurs contacts pour un meme utilisateur Plex.
- Templates de messages pour annonces de groupe et notifications individuelles.
- Enrichissement TMDB: titre francais, date de sortie, affiche, synopsis, note si disponible.
- Regle "nouveaute recente" basee par defaut sur une sortie de moins de 6 mois, avec reglage modifiable.
- Routage des sources de verite: Overseerr pour films et saison 1; Plex pour saisons 2+ et nouveaux episodes individuels.
- Prise en compte des demandes/suivis Overseerr pour relier les contenus aux demandeurs lorsque la source de verite est Overseerr ou pour completer le ciblage individuel.
- Detection des spectateurs d'une serie via historique Plex/Tautulli.
- Recap automatique le premier jour du mois dans un message unique films + series.
- Selection des bibliotheques Plex incluses dans les recaps.
- Envoi individuel a tous les contacts WhatsApp lies a un utilisateur Plex, pas seulement au contact principal.
- Interface simple dans l'esprit Overseerr/Radarr, orientee configuration et suivi operationnel plutot que dashboard complexe.

Hors scope probable de premiere version:

- Bot conversationnel complet.
- Gestion multi-serveurs Plex avancee.
- Plusieurs administrateurs.
- Plusieurs sessions WhatsApp.
- Recommandations personnalisees complexes.
- Remplacement complet des notifications natives de chaque outil.

## Vision

Si Whatsarr fonctionne, il devient le centre de communication WhatsApp d'un serveur multimedia self-hosted: une application simple a installer, fiable, qui transforme les evenements Plex/Arr en messages utiles, beaux et contextualises pour les bonnes personnes.
