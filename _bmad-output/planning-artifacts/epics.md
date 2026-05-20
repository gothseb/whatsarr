---
stepsCompleted: [1, 2, 3, 4]
workflowType: "epics-and-stories"
status: "complete"
completedAt: "2026-05-19"
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-whatsarr-2026-05-19/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
---

# whatsarr - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for whatsarr, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: L'Administrateur peut renseigner et modifier les URL, cles API et secrets necessaires pour Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB; les valeurs sont persistantes, survivent au redemarrage Docker et les secrets ne sont pas affiches en clair apres sauvegarde.

FR2: L'Administrateur peut tester chaque integration separement; chaque service affiche un statut connecte, erreur d'authentification, inaccessible ou non configure, avec un message exploitable sans exposer le secret.

FR3: L'Administrateur peut demarrer une session WhatsApp Web et scanner un QR code depuis l'interface; l'interface affiche l'etat de session et une session connectee permet de lister les groupes WhatsApp.

FR4: Whatsarr conserve l'etat necessaire pour restaurer la session WhatsApp Web apres redemarrage Docker; si WhatsApp invalide la session, l'interface demande une nouvelle connexion QR.

FR5: Whatsarr supporte exactement une Session WhatsApp Web en V1; l'interface ne propose pas de multi-session et une nouvelle connexion remplace la session existante apres confirmation.

FR6: L'Administrateur peut voir la liste des groupes WhatsApp accessibles a la Session WhatsApp Web et choisir le Groupe serveur; le choix est persistant et tout changement demande confirmation.

FR7: Whatsarr recupere les Contact WhatsApp du Groupe serveur; la liste affiche nom, identifiant WhatsApp et etat de mapping, avec rafraichissement manuel.

FR8: L'Administrateur peut associer un Utilisateur Plex a un ou plusieurs Contact WhatsApp; les messages individuels sont envoyes a tous les contacts lies et les utilisateurs sans contact sont signales comme non notifiables.

FR9: L'Administrateur peut modifier les templates pour annonce groupe, demande disponible, nouvel episode et Recap mensuel; chaque template accepte des variables documentees, propose un apercu et refuse les variables inconnues.

FR10: Whatsarr detecte les disponibilites a annoncer avec Overseerr comme source de verite pour les films et la premiere saison d'une serie, et Plex comme source de verite pour les premiers episodes des saisons suivantes a partir de la saison 2; un contenu deja annonce n'est pas republie en double et un historique minimal des annonces est conserve.

FR11: Whatsarr recupere les metadonnees TMDB utiles; un message peut inclure titre francais, affiche, synopsis, date de sortie et note si disponible, avec attribution TMDB et degradation vers donnees Plex si TMDB ne trouve pas de correspondance fiable.

FR12: Whatsarr annonce dans le Groupe serveur uniquement les Nouveautes recentes; la fenetre vaut 6 mois par defaut, est configurable, et exclut les contenus hors fenetre.

FR13: Whatsarr envoie automatiquement dans le Groupe serveur une annonce pour chaque Nouveaute recente eligible; le message utilise le template annonce groupe, peut inclure une affiche et journalise les echecs avec retry manuel ou automatique limite.

FR14: Quand une Demande devient disponible, Whatsarr identifie l'Utilisateur Plex demandeur et envoie un message a tous ses Contact WhatsApp lies; Overseerr est la source de verite pour films/saison 1, Plex pour nouvelles saisons et episodes non suivis finement par Overseerr; les utilisateurs sans contact sont journalises comme non notifies.

FR15: Quand un nouvel episode est disponible, Whatsarr utilise Plex comme source de verite et notifie les Utilisateurs Plex qui ont regarde la serie et ceux qui l'ont demandee ou suivie; le ciblage deduplique les utilisateurs et envoie a tous les contacts lies.

FR16: L'Administrateur peut choisir quelles Bibliotheques Plex alimentent le Recap mensuel; le choix est persistant.

FR17: Whatsarr calcule les films et series les plus vus par nombre d'Utilisateurs Plex distincts; le classement ne compte pas plusieurs lectures du meme utilisateur, couvre le mois civil precedent et combine films et series dans le meme message.

FR18: Whatsarr envoie le Recap mensuel dans le Groupe serveur le premier jour du mois; le message utilise le template Recap mensuel, n'est pas envoye deux fois automatiquement pour le meme mois et expose le dernier statut d'envoi.

FR19: L'Administrateur peut consulter les derniers envois, evenements ignores et erreurs; chaque entree indique type d'evenement, cible, statut, horodatage et cause d'erreur si applicable, y compris les doublons evites.

FR20: Whatsarr conserve assez d'etat pour eviter de renvoyer plusieurs fois le meme message automatique; cela couvre annonces groupe, demandes disponibles et recaps mensuels.

### NonFunctional Requirements

NFR1: Fiabilite - Les redemarrages Docker ne doivent pas effacer la configuration, les mappings, l'historique anti-doublon ou la session WhatsApp lorsque celle-ci reste valide.

NFR2: Observabilite - Les evenements entrants, decisions de filtrage, envois, echecs et doublons evites doivent etre journalises.

NFR3: Confidentialite - Les cles API, tokens, identifiants WhatsApp et mappings utilisateur/contact sont des donnees sensibles et ne doivent pas etre exposes inutilement dans l'interface ou les logs.

NFR4: Simplicite UI - L'interface doit rester proche des conventions Overseerr/Radarr avec navigation claire, pages de configuration, etats de connexion, listes editables et logs lisibles.

NFR5: Degradation - Quand un service secondaire est indisponible, Whatsarr doit expliquer ce qui est bloque ou degrade plutot que produire un comportement silencieux.

NFR6: Maintenabilite - Les integrations externes doivent etre separees du moteur metier pour faciliter les changements, notamment WhatsApp derriere `WhatsAppAdapter`.

NFR7: Coherence d'implementation - Les agents doivent respecter snake_case en base, camelCase en API/UI, REST JSON, events dot.case, jobs persistants et logique metier cote backend.

### Additional Requirements

- Initialiser un monorepo TypeScript avec Turborepo, `apps/api` NestJS, `apps/web` Vite React et `packages/shared`.
- Utiliser Node.js + TypeScript partout.
- Utiliser SQLite + Prisma en V1 avec migrations versionnees.
- Utiliser une table d'outbox/jobs persistante en SQLite pour toute notification WhatsApp; ne pas utiliser Redis/BullMQ en V1.
- Servir l'application via Docker Compose avec un service applicatif principal et un volume `/data`.
- Stocker dans `/data` SQLite, session WhatsApp, fichiers temporaires et etat persistant.
- Implementer une auth locale single-admin avec mot de passe, session cookie HTTP-only, rate limit login et CORS limite.
- Chiffrer les tokens/API keys en base avec une cle applicative et masquer les secrets dans l'UI.
- Exposer une API REST JSON documentee via OpenAPI.
- Utiliser SSE pour QR WhatsApp, etat session, etat integrations et logs/messages recents.
- Encapsuler Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB dans des modules d'integration dedies.
- Centraliser le routage de source de verite media: Overseerr pour films/saison 1, Plex pour saisons 2+ et nouveaux episodes individuels.
- Encapsuler WhatsApp derriere `WhatsAppAdapter`, avec driver V1 `whatsapp-web.js` + Puppeteer/Chromium.
- Inclure Chromium/Puppeteer et les flags Docker necessaires au headless Linux.
- Ne jamais envoyer de message WhatsApp directement depuis un controller; tous les envois passent par `notification_jobs`.
- Produire une `dedupe_key` deterministe pour tout evenement pouvant declencher un message.
- Garder la logique de notification, filtrage "sortie recente" et anti-doublon cote backend.
- Organiser l'UI avec pages Dashboard, Parametres, WhatsApp, Mapping, Templates et Logs.
- Utiliser TanStack Query pour les donnees UI, React Hook Form pour les formulaires, shadcn/ui + Tailwind pour l'interface.
- Produire des logs operationnels sans secrets, avec niveaux `debug`, `info`, `warn`, `error` et `requestId` dans les erreurs API.
- Premier travail d'implementation: initialiser monorepo, API, UI, Docker Compose, Prisma SQLite et volume `/data`.

### UX Design Requirements

Aucun document UX separe n'a ete fourni. Les exigences UI extraites du PRD et de l'architecture sont:

UX-DR1: Interface simple inspiree Overseerr/Radarr avec navigation claire et pages dediees Dashboard, Parametres, WhatsApp, Mapping, Templates et Logs.

UX-DR2: Page Parametres permettant de renseigner, masquer apres sauvegarde et tester les URL/cles/secrets de Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB.

UX-DR3: Page WhatsApp affichant QR code, etat de session, liste des groupes WhatsApp et action de selection du Groupe serveur.

UX-DR4: Page Mapping affichant membres WhatsApp, utilisateurs Plex, etat de mapping et support de plusieurs contacts WhatsApp par utilisateur Plex.

UX-DR5: Page Templates permettant d'editer les templates, voir les variables disponibles, generer un apercu et bloquer la sauvegarde en cas de variable inconnue.

UX-DR6: Page Logs affichant derniers envois, evenements ignores, erreurs et doublons evites avec statut, cible, horodatage et cause.

UX-DR7: Etats live via SSE pour connexion WhatsApp, QR code, etat des integrations et messages/logs recents.

### FR Coverage Map

FR1: Epic 1 - Configuration persistante des acces services
FR2: Epic 1 - Tests de connexion et statuts d'integration
FR3: Epic 2 - Connexion WhatsApp Web par QR code
FR4: Epic 2 - Persistance et restauration de session WhatsApp
FR5: Epic 2 - Limitation V1 a une seule session WhatsApp
FR6: Epic 2 - Selection du Groupe serveur
FR7: Epic 2 - Import et rafraichissement des membres WhatsApp
FR8: Epic 3 - Mapping Utilisateur Plex vers Contact WhatsApp
FR9: Epic 4 - Templates de messages configurables
FR10: Epic 4 - Detection des disponibilites par source de verite
FR11: Epic 4 - Enrichissement TMDB et fallback Plex
FR12: Epic 4 - Filtrage des sorties recentes
FR13: Epic 4 - Publication automatique d'annonces groupe
FR14: Epic 4 - Notification individuelle de demande disponible
FR15: Epic 4 - Notification individuelle de nouvel episode
FR16: Epic 5 - Configuration des bibliotheques du recap mensuel
FR17: Epic 5 - Calcul des contenus les plus vus
FR18: Epic 5 - Envoi automatique du recap mensuel
FR19: Epic 5 - Consultation des logs, erreurs et evenements ignores
FR20: Epic 4 - Anti-doublon des messages automatiques

## Epic List

### Epic 1: Installer Whatsarr et connecter les services media
L'administrateur peut installer Whatsarr en Docker, creer l'acces admin, configurer les services media, tester les connexions et disposer d'une base persistante fiable.
**FRs covered:** FR1, FR2

### Epic 2: Connecter WhatsApp et definir le groupe serveur
L'administrateur peut connecter son compte WhatsApp via QR code, conserver la session apres redemarrage, lister ses groupes et choisir le groupe WhatsApp du serveur.
**FRs covered:** FR3, FR4, FR5, FR6, FR7

### Epic 3: Lier utilisateurs Plex et contacts WhatsApp
L'administrateur peut importer les utilisateurs Plex et les membres du groupe WhatsApp, puis associer un utilisateur Plex a un ou plusieurs contacts WhatsApp pour rendre les notifications individuelles possibles.
**FRs covered:** FR8

### Epic 4: Automatiser les messages WhatsApp utiles
L'administrateur peut personnaliser les templates et Whatsarr peut envoyer automatiquement les annonces de nouveautes recentes, les notifications de demandes disponibles et les alertes de nouveaux episodes, avec routage de source de verite, enrichissement TMDB, outbox, retry et anti-doublon.
**FRs covered:** FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR20

### Epic 5: Suivre l'activite et envoyer le recap mensuel
L'administrateur peut choisir les bibliotheques Plex a inclure, Whatsarr calcule le classement mensuel films + series par utilisateurs distincts, envoie le recap automatiquement et expose les logs/statuts operationnels.
**FRs covered:** FR16, FR17, FR18, FR19

## Epic 1: Installer Whatsarr et connecter les services media

L'administrateur peut installer Whatsarr en Docker, creer l'acces admin, configurer les services media, tester les connexions et disposer d'une base persistante fiable.

### Story 1.1: Set up initial project from starter template

**Requirements:** Additional architecture starter requirements, NFR1, NFR7

As a Administrateur,
I want installer Whatsarr via Docker avec stockage persistant,
So that l'application puisse etre lancee et conserver ses donnees apres redemarrage.

**Acceptance Criteria:**

**Given** un repo vide ou fraichement initialise
**When** le projet est scaffolde
**Then** il contient un monorepo Turborepo avec `apps/api`, `apps/web` et `packages/shared`
**And** il utilise TypeScript, NestJS cote API et Vite React cote UI.

**Given** l'administrateur lance Docker Compose
**When** le service `whatsarr` demarre
**Then** l'API repond a un healthcheck
**And** un volume `/data` est monte pour les donnees persistantes.

**Given** le conteneur est redemarre
**When** l'application redemarre
**Then** les fichiers persistants dans `/data` sont conserves.

### Story 1.2: Creer l'acces administrateur local

**Requirements:** Additional security requirements, NFR3, NFR4

As a Administrateur,
I want creer et utiliser un acces admin local,
So that l'interface de configuration ne soit pas ouverte sans protection.

**Acceptance Criteria:**

**Given** aucun administrateur n'existe encore
**When** l'utilisateur ouvre l'application
**Then** l'interface propose de creer le mot de passe admin initial
**And** le mot de passe est stocke sous forme hashee.

**Given** un administrateur existe
**When** l'utilisateur se connecte avec le bon mot de passe
**Then** une session HTTP-only est creee
**And** l'utilisateur peut acceder aux pages protegees.

**Given** une tentative de connexion echoue
**When** le mot de passe est incorrect
**Then** l'acces est refuse
**And** le secret ou le hash n'est jamais expose dans les logs.

### Story 1.3: Stocker la configuration et les secrets

**Requirements:** FR1, NFR1, NFR3

As a Administrateur,
I want sauvegarder les URL, cles API et secrets des services media,
So that Whatsarr puisse les reutiliser apres redemarrage sans les afficher en clair.

**Acceptance Criteria:**

**Given** l'administrateur renseigne une URL ou une cle API
**When** il sauvegarde la configuration
**Then** la valeur est persistee en SQLite via Prisma
**And** les secrets sont chiffres ou stockes via le mecanisme securise prevu par l'architecture.

**Given** une cle API a ete sauvegardee
**When** l'interface affiche la configuration
**Then** la cle est masquee
**And** l'administrateur peut la remplacer sans voir l'ancienne valeur en clair.

**Given** le conteneur Docker redemarre
**When** l'administrateur revient sur la page Parametres
**Then** la configuration non secrete est toujours disponible
**And** les secrets restent utilisables pour les tests de connexion.

### Story 1.4: Configurer les services media dans l'interface

**Requirements:** FR1, UX-DR1, UX-DR2, NFR4

As a Administrateur,
I want configurer Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB depuis une page Parametres,
So that Whatsarr connaisse les services a connecter.

**Acceptance Criteria:**

**Given** l'administrateur ouvre la page Parametres
**When** les sections services sont affichees
**Then** il voit les champs necessaires pour Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB
**And** chaque service peut etre configure independamment.

**Given** un champ requis est invalide ou vide
**When** l'administrateur tente de sauvegarder
**Then** l'interface affiche une erreur claire
**And** aucune valeur invalide n'ecrase la configuration existante.

**Given** la configuration est sauvegardee
**When** l'API renvoie les parametres
**Then** les champs exposes a l'UI sont en camelCase
**And** les modeles Prisma ne sont pas exposes bruts.

### Story 1.5: Tester les connexions aux services media

**Requirements:** FR2, NFR2, NFR3, NFR5

As a Administrateur,
I want tester chaque integration separement,
So that je sache quels services sont prets avant d'activer les automatisations.

**Acceptance Criteria:**

**Given** un service est configure
**When** l'administrateur clique sur "Tester"
**Then** Whatsarr appelle le service concerne
**And** affiche un statut `connecte`, `erreur d'authentification`, `inaccessible` ou `non configure`.

**Given** un test echoue
**When** le statut est affiche
**Then** le message explique l'action probable a corriger
**And** aucun secret n'est affiche dans l'erreur ou les logs.

**Given** plusieurs services sont configures
**When** l'administrateur teste chaque service
**Then** chaque resultat est independant
**And** un echec TMDB ne bloque pas le statut Plex, Tautulli ou Overseerr.

## Epic 2: Connecter WhatsApp et definir le groupe serveur

L'administrateur peut connecter son compte WhatsApp via QR code, conserver la session apres redemarrage, lister ses groupes et choisir le groupe WhatsApp du serveur.

### Story 2.1: Preparer l'adaptateur WhatsApp Web

**Requirements:** FR3, FR4, FR5, NFR6

As a Administrateur,
I want que Whatsarr dispose d'un adaptateur WhatsApp Web isole,
So that la connexion WhatsApp puisse evoluer sans impacter le reste de l'application.

**Acceptance Criteria:**

**Given** le backend Whatsarr est en place
**When** le module WhatsApp est ajoute
**Then** il expose une interface `WhatsAppAdapter`
**And** le driver V1 `whatsapp-web.js` est implemente derriere cette interface.

**Given** un autre module doit envoyer ou lire des donnees WhatsApp
**When** il interagit avec WhatsApp
**Then** il utilise le service WhatsApp ou `WhatsAppAdapter`
**And** il ne depend pas directement de `whatsapp-web.js`.

**Given** l'application tourne en Docker
**When** le conteneur demarre
**Then** Chromium/Puppeteer et les options headless necessaires sont disponibles
**And** les erreurs de demarrage WhatsApp sont journalisees sans secrets.

### Story 2.2: Connecter WhatsApp via QR code

**Requirements:** FR3, UX-DR3, UX-DR7

As a Administrateur,
I want scanner un QR code WhatsApp depuis l'interface,
So that Whatsarr puisse utiliser mon compte WhatsApp comme session Web.

**Acceptance Criteria:**

**Given** aucune session WhatsApp n'est connectee
**When** l'administrateur ouvre la page WhatsApp
**Then** il peut demarrer une connexion
**And** un QR code est affiche via l'UI.

**Given** le QR code est affiche
**When** l'administrateur le scanne avec WhatsApp
**Then** la session passe a l'etat `connectee`
**And** l'etat est mis a jour dans l'interface via SSE.

**Given** la connexion echoue ou expire
**When** l'etat WhatsApp change
**Then** l'interface affiche un etat exploitable
**And** l'administrateur peut relancer une tentative de connexion.

### Story 2.3: Persister et restaurer la session WhatsApp

**Requirements:** FR4, NFR1, NFR3

As a Administrateur,
I want que ma session WhatsApp reste active apres redemarrage Docker,
So that je n'aie pas a rescanner un QR code a chaque relance.

**Acceptance Criteria:**

**Given** une session WhatsApp est connectee
**When** Whatsarr sauvegarde l'etat de session
**Then** les donnees necessaires sont stockees dans `/data`
**And** elles ne sont pas stockees dans le repo.

**Given** le conteneur redemarre avec le volume `/data` conserve
**When** Whatsarr demarre
**Then** il tente de restaurer la session automatiquement
**And** l'interface affiche l'etat reel de restauration.

**Given** WhatsApp invalide la session
**When** Whatsarr ne peut pas restaurer la connexion
**Then** l'interface demande une nouvelle connexion QR
**And** l'erreur est loggee sans exposer les donnees de session.

### Story 2.4: Limiter la V1 a une seule session WhatsApp

**Requirements:** FR5

As a Administrateur,
I want gerer une seule session WhatsApp dans Whatsarr,
So that le comportement reste simple et previsible en V1.

**Acceptance Criteria:**

**Given** une session WhatsApp existe deja
**When** l'administrateur tente de creer une nouvelle connexion
**Then** l'interface explique qu'une seule session est supportee
**And** demande confirmation avant remplacement.

**Given** l'administrateur confirme le remplacement
**When** la nouvelle session est creee
**Then** l'ancienne session locale est supprimee ou invalidee cote Whatsarr
**And** la nouvelle session devient la session active unique.

**Given** une API interne demande la session active
**When** elle interroge le service WhatsApp
**Then** une seule session peut etre retournee
**And** aucun modele multi-session n'est expose en V1.

### Story 2.5: Lister les groupes WhatsApp

**Requirements:** FR3, FR6, UX-DR3

As a Administrateur,
I want voir les groupes disponibles sur mon WhatsApp,
So that je puisse choisir le groupe dedie au serveur Plex.

**Acceptance Criteria:**

**Given** la session WhatsApp est connectee
**When** l'administrateur ouvre la page WhatsApp
**Then** Whatsarr recupere les groupes accessibles
**And** affiche leur nom et identifiant technique.

**Given** la session WhatsApp n'est pas connectee
**When** l'administrateur tente d'afficher les groupes
**Then** l'interface indique qu'une connexion WhatsApp est requise
**And** aucun appel de liste groupe n'est tente sans session valide.

**Given** la liste des groupes est chargee
**When** l'administrateur clique sur rafraichir
**Then** Whatsarr recharge la liste depuis WhatsApp
**And** affiche une erreur claire si WhatsApp ne repond pas.

### Story 2.6: Definir le groupe WhatsApp du serveur

**Requirements:** FR6, NFR2

As a Administrateur,
I want selectionner le groupe WhatsApp du serveur Plex,
So that les annonces collectives soient publiees au bon endroit.

**Acceptance Criteria:**

**Given** la liste des groupes WhatsApp est affichee
**When** l'administrateur selectionne un groupe
**Then** ce groupe est sauvegarde comme Groupe serveur
**And** le choix persiste apres redemarrage Docker.

**Given** un Groupe serveur est deja selectionne
**When** l'administrateur choisit un autre groupe
**Then** une confirmation est demandee
**And** le changement est journalise.

**Given** aucun Groupe serveur n'est selectionne
**When** une fonctionnalite d'annonce groupe est appelee plus tard
**Then** elle doit echouer proprement avec une erreur `WHATSAPP_GROUP_NOT_SELECTED`.

### Story 2.7: Importer et rafraichir les membres du groupe serveur

**Requirements:** FR7, UX-DR4

As a Administrateur,
I want importer les membres du groupe WhatsApp serveur,
So that je puisse ensuite les lier aux utilisateurs Plex.

**Acceptance Criteria:**

**Given** un Groupe serveur est selectionne
**When** l'administrateur lance l'import des membres
**Then** Whatsarr recupere les contacts du groupe
**And** stocke nom, identifiant WhatsApp et date de derniere synchronisation.

**Given** des membres ont deja ete importes
**When** l'administrateur relance un rafraichissement
**Then** les membres ajoutes ou retires sont refletes dans la liste
**And** les mappings existants sont conserves quand l'identifiant WhatsApp existe toujours.

**Given** un membre du groupe n'est lie a aucun utilisateur Plex
**When** la liste est affichee
**Then** son etat de mapping indique `non lie`.

## Epic 3: Lier utilisateurs Plex et contacts WhatsApp

L'administrateur peut importer les utilisateurs Plex et les membres du groupe WhatsApp, puis associer un utilisateur Plex a un ou plusieurs contacts WhatsApp pour rendre les notifications individuelles possibles.

### Story 3.1: Importer les utilisateurs Plex

**Requirements:** FR8, UX-DR4, NFR5

As a Administrateur,
I want importer les utilisateurs Plex accessibles au serveur,
So that je puisse les associer aux contacts WhatsApp.

**Acceptance Criteria:**

**Given** Plex est configure et joignable
**When** l'administrateur ouvre la page Mapping
**Then** Whatsarr peut recuperer les utilisateurs Plex
**And** affiche leur nom, identifiant Plex et etat de mapping.

**Given** Plex n'est pas configure ou inaccessible
**When** l'import est demande
**Then** l'interface affiche une erreur exploitable
**And** aucun mapping existant n'est supprime.

**Given** des utilisateurs Plex ont deja ete importes
**When** l'administrateur relance une synchronisation
**Then** les utilisateurs nouveaux ou modifies sont mis a jour
**And** les associations existantes sont conservees quand l'identifiant Plex existe toujours.

### Story 3.2: Afficher les contacts WhatsApp et utilisateurs Plex a lier

**Requirements:** FR8, UX-DR4, NFR4

As a Administrateur,
I want voir cote a cote les utilisateurs Plex et les contacts WhatsApp du groupe,
So that je puisse identifier rapidement ce qui est lie ou non.

**Acceptance Criteria:**

**Given** des utilisateurs Plex et contacts WhatsApp existent
**When** l'administrateur ouvre la page Mapping
**Then** l'interface affiche les utilisateurs Plex
**And** affiche les contacts WhatsApp disponibles.

**Given** un utilisateur Plex a deja un ou plusieurs contacts lies
**When** la liste est affichee
**Then** les contacts lies sont visibles sur la ligne de l'utilisateur
**And** l'etat de mapping indique `lie`.

**Given** un utilisateur Plex n'a aucun contact lie
**When** la liste est affichee
**Then** l'etat de mapping indique `non notifiable`.

### Story 3.3: Associer un utilisateur Plex a un contact WhatsApp

**Requirements:** FR8, NFR1

As a Administrateur,
I want associer un utilisateur Plex a un contact WhatsApp,
So that Whatsarr sache a qui envoyer les notifications individuelles.

**Acceptance Criteria:**

**Given** un utilisateur Plex et un contact WhatsApp existent
**When** l'administrateur cree une association
**Then** le mapping est sauvegarde en base
**And** il reste disponible apres redemarrage Docker.

**Given** l'association existe deja
**When** l'administrateur tente de la recreer
**Then** Whatsarr empeche le doublon
**And** affiche une information claire.

**Given** un contact WhatsApp est lie
**When** une notification individuelle cible cet utilisateur plus tard
**Then** ce contact fait partie des destinataires possibles.

### Story 3.4: Associer plusieurs contacts WhatsApp a un utilisateur Plex

**Requirements:** FR8

As a Administrateur,
I want associer plusieurs contacts WhatsApp au meme utilisateur Plex,
So that tous les contacts lies recoivent les messages individuels.

**Acceptance Criteria:**

**Given** un utilisateur Plex existe
**When** l'administrateur ajoute plusieurs contacts WhatsApp a cet utilisateur
**Then** chaque association est sauvegardee
**And** l'interface affiche tous les contacts lies.

**Given** un utilisateur Plex a plusieurs contacts lies
**When** le service de notification resout les destinataires
**Then** tous les contacts lies sont retournes
**And** aucun contact n'est ignore sans raison journalisee.

**Given** deux contacts sont lies au meme utilisateur
**When** une notification individuelle est produite plus tard
**Then** un job d'envoi peut etre cree pour chaque contact.

### Story 3.5: Supprimer ou modifier un mapping

**Requirements:** FR8, NFR1

As a Administrateur,
I want supprimer ou modifier une association Plex/WhatsApp,
So that je puisse corriger les erreurs de mapping.

**Acceptance Criteria:**

**Given** un mapping existe
**When** l'administrateur le supprime
**Then** l'association est retiree
**And** l'utilisateur Plex ou le contact WhatsApp ne sont pas supprimes.

**Given** un utilisateur Plex avait un seul contact lie
**When** ce mapping est supprime
**Then** l'utilisateur repasse a l'etat `non notifiable`.

**Given** l'administrateur ajoute un nouveau contact apres suppression
**When** il sauvegarde
**Then** le nouvel etat de mapping est visible immediatement.

### Story 3.6: Signaler les utilisateurs non notifiables

**Requirements:** FR8, FR14, NFR2

As a Administrateur,
I want voir quels utilisateurs Plex ne peuvent pas recevoir de message individuel,
So that je puisse completer les mappings manquants.

**Acceptance Criteria:**

**Given** certains utilisateurs Plex n'ont aucun contact WhatsApp lie
**When** la page Mapping est affichee
**Then** ils sont clairement marques comme `non notifiables`.

**Given** un evenement de notification cible un utilisateur non notifiable plus tard
**When** le systeme resout les destinataires
**Then** aucun message n'est envoye
**And** un log operationnel indique que l'utilisateur n'a pas de contact lie.

**Given** tous les utilisateurs Plex ont au moins un contact lie
**When** la page Mapping est affichee
**Then** aucun avertissement global de mapping incomplet n'est affiche.

## Epic 4: Automatiser les messages WhatsApp utiles

L'administrateur peut personnaliser les templates et Whatsarr peut envoyer automatiquement les annonces de nouveautes recentes, les notifications de demandes disponibles et les alertes de nouveaux episodes, avec routage de source de verite, enrichissement TMDB, outbox, retry et anti-doublon.

### Story 4.1: Creer le moteur de templates de messages

**Requirements:** FR9, UX-DR5

As a Administrateur,
I want modifier les textes types des messages automatiques,
So that les annonces WhatsApp utilisent mon ton et les informations utiles.

**Acceptance Criteria:**

**Given** l'administrateur ouvre la page Templates
**When** les templates sont affiches
**Then** il voit les templates `annonce groupe`, `demande disponible`, `nouvel episode` et `recap mensuel`
**And** chaque template est sauvegarde en base.

**Given** un template contient des variables valides
**When** l'administrateur genere un apercu
**Then** Whatsarr affiche un rendu avec des donnees d'exemple
**And** les variables sont remplacees correctement.

**Given** un template contient une variable inconnue
**When** l'administrateur sauvegarde
**Then** la sauvegarde est refusee
**And** l'interface indique la variable invalide.

### Story 4.2: Creer l'outbox de notifications WhatsApp

**Requirements:** FR13, FR14, FR15, FR20, NFR1, NFR2

As a Administrateur,
I want que tous les messages WhatsApp passent par une file persistante,
So that les envois soient tracables, rejouables et proteges contre les doublons.

**Acceptance Criteria:**

**Given** un module veut envoyer un message WhatsApp
**When** il cree une notification
**Then** une entree `notification_jobs` est creee
**And** aucun message n'est envoye directement depuis un controller.

**Given** un job est cree
**When** il est persiste
**Then** il contient type, cible, payload, status, attempts, `dedupe_key`, `scheduled_at`, `sent_at` et `failed_at`.

**Given** un job avec la meme `dedupe_key` existe deja
**When** une nouvelle creation est tentee
**Then** Whatsarr empeche le doublon
**And** journalise que l'evenement a ete deduplique.

### Story 4.3: Executer les jobs d'envoi WhatsApp

**Requirements:** FR13, FR14, FR15, FR20, NFR2, NFR5

As a Administrateur,
I want que Whatsarr traite les messages en attente automatiquement,
So that les notifications partent sans action manuelle.

**Acceptance Criteria:**

**Given** un job `pending` existe
**When** le worker jobs s'execute
**Then** il envoie le message via `WhatsAppAdapter`
**And** met le job a `sent` si l'envoi reussit.

**Given** WhatsApp est deconnecte ou l'envoi echoue
**When** le worker traite le job
**Then** le job passe a `failed` ou `retry_scheduled` selon la strategie retenue
**And** l'erreur est loggee sans secret.

**Given** un job echoue est relance
**When** l'envoi reussit
**Then** le job conserve son historique d'attempts
**And** aucun doublon de job n'est cree.

### Story 4.4: Router les nouvelles disponibilites media

**Requirements:** FR10, FR20, NFR2, NFR5

As a Administrateur,
I want que Whatsarr route les disponibilites media depuis Overseerr ou Plex selon le type de contenu,
So that les annonces puissent partir automatiquement.

**Acceptance Criteria:**

**Given** Overseerr signale un film ou une premiere saison disponible
**When** l'evenement est traite
**Then** Whatsarr le normalise en `media.availability.routed`
**And** conserve `overseerr` comme source de verite.

**Given** Plex signale le ou les premiers episodes d'une saison 2 ou superieure
**When** l'evenement est traite
**Then** Whatsarr le normalise en disponibilite de nouvelle saison
**And** conserve `plex` comme source de verite.

**Given** le meme contenu est detecte plusieurs fois
**When** l'evenement est traite
**Then** une cle anti-doublon deterministe est produite
**And** le contenu ou la saison n'est pas annonce plusieurs fois.

**Given** Plex est indisponible
**When** une detection Plex est tentee pour une saison 2+ ou un nouvel episode
**Then** l'echec est logge
**And** aucune annonce incomplete n'est creee.

### Story 4.5: Enrichir les contenus avec TMDB

**Requirements:** FR11, NFR5

As a Administrateur,
I want que les films et series soient enrichis via TMDB,
So that les messages contiennent titre francais, affiche, synopsis, date et note.

**Acceptance Criteria:**

**Given** un contenu Plex a des metadonnees suffisantes
**When** Whatsarr interroge TMDB
**Then** il recupere les champs disponibles : titre francais, affiche, synopsis, date de sortie et note
**And** conserve l'identifiant TMDB si trouve.

**Given** TMDB ne trouve pas de correspondance fiable
**When** un message doit etre genere
**Then** Whatsarr utilise les donnees Plex disponibles
**And** journalise que l'enrichissement est degrade.

**Given** l'application affiche une page A propos ou Parametres
**When** TMDB est utilise
**Then** une attribution TMDB est visible conformement a l'exigence PRD.

### Story 4.6: Filtrer les nouveautes recentes

**Requirements:** FR12, FR20, NFR2

As a Administrateur,
I want limiter les annonces groupe aux sorties recentes,
So that le groupe WhatsApp ne recoive que des nouveautes pertinentes.

**Acceptance Criteria:**

**Given** le seuil recent n'a jamais ete modifie
**When** Whatsarr evalue un contenu
**Then** la fenetre par defaut est de 6 mois.

**Given** l'administrateur modifie le seuil recent
**When** il sauvegarde le reglage
**Then** la nouvelle valeur est persistee
**And** les prochaines evaluations utilisent ce seuil.

**Given** un contenu a une date de sortie hors fenetre
**When** l'evenement est traite
**Then** aucune annonce groupe n'est creee
**And** l'evenement ignore est logge avec la raison `not_recent`.

### Story 4.7: Publier les annonces groupe de nouveautes

**Requirements:** FR13, FR20

As a Administrateur,
I want que Whatsarr publie automatiquement les nouveautes recentes dans le groupe serveur,
So that les membres soient informes des nouveaux films et series disponibles.

**Acceptance Criteria:**

**Given** un contenu route est disponible, enrichi et recent
**When** l'evenement est traite
**Then** Whatsarr cree un job d'annonce groupe
**And** le job cible le Groupe serveur.

**Given** le job d'annonce est execute
**When** le message est envoye
**Then** il utilise le template `annonce groupe`
**And** inclut l'affiche lorsque disponible.

**Given** aucun Groupe serveur n'est selectionne
**When** une annonce doit etre creee
**Then** aucun job WhatsApp n'est cree
**And** une erreur `WHATSAPP_GROUP_NOT_SELECTED` est loggee.

### Story 4.8: Detecter et notifier une demande disponible

**Requirements:** FR14, FR20

As a Administrateur,
I want que Whatsarr previenne l'utilisateur quand sa demande est disponible,
So that je n'aie pas a le faire manuellement.

**Acceptance Criteria:**

**Given** une demande Overseerr devient disponible
**When** Whatsarr traite l'evenement pour un film ou une saison 1
**Then** il identifie l'Utilisateur Plex demandeur
**And** prepare une notification individuelle.

**Given** Plex signale une saison 2+ ou un nouvel episode lie a une serie demandee ou suivie
**When** Whatsarr resout les utilisateurs concernes
**Then** il utilise Plex comme source de disponibilite
**And** conserve les donnees Overseerr uniquement pour le lien demandeur/suivi.

**Given** l'utilisateur a plusieurs contacts WhatsApp lies
**When** la notification est creee
**Then** un job est cree pour chaque contact lie
**And** tous les jobs partagent une cle anti-doublon adaptee a la cible.

**Given** l'utilisateur n'a aucun contact lie
**When** la demande devient disponible
**Then** aucun message n'est envoye
**And** un log indique que l'utilisateur est non notifiable.

### Story 4.9: Detecter et notifier les nouveaux episodes

**Requirements:** FR15, FR20

As a Administrateur,
I want que Whatsarr previenne les spectateurs et demandeurs quand un nouvel episode arrive,
So that les personnes interessees soient informees directement.

**Acceptance Criteria:**

**Given** un nouvel episode est disponible sur Plex
**When** l'evenement est traite
**Then** Whatsarr identifie la serie, la saison et l'episode
**And** prepare une notification `nouvel episode` avec Plex comme source de verite.

**Given** le premier ou les premiers episodes d'une saison 2+ arrivent sur Plex
**When** l'evenement est traite
**Then** Whatsarr peut aussi produire une disponibilite de nouvelle saison dedupliquee au niveau serie/saison.

**Given** des utilisateurs ont regarde la serie ou l'ont demandee/suivie
**When** les destinataires sont resolus
**Then** les utilisateurs sont dedupliques
**And** tous les contacts WhatsApp lies a chaque utilisateur sont cibles.

**Given** un meme utilisateur apparait via historique et demande
**When** les jobs sont crees
**Then** l'utilisateur ne recoit pas deux fois le meme message sur le meme contact.

### Story 4.10: Afficher les statuts et erreurs des messages automatiques

**Requirements:** FR19, FR20, UX-DR6, UX-DR7, NFR2, NFR3

As a Administrateur,
I want voir les resultats des messages automatiques,
So that je puisse diagnostiquer les annonces envoyees, ignorees ou echouees.

**Acceptance Criteria:**

**Given** des jobs de notification existent
**When** l'administrateur ouvre les logs ou le dashboard
**Then** il voit les derniers jobs avec type, cible, statut et horodatage.

**Given** un evenement est ignore par anti-doublon ou filtre recent
**When** les logs sont affiches
**Then** la raison est visible
**And** le message ne contient pas de secret.

**Given** un message echoue
**When** l'erreur est consultee
**Then** l'interface affiche une cause exploitable
**And** le log technique contient un `requestId`.

## Epic 5: Suivre l'activite et envoyer le recap mensuel

L'administrateur peut choisir les bibliotheques Plex a inclure, Whatsarr calcule le classement mensuel films + series par utilisateurs distincts, envoie le recap automatiquement et expose les logs/statuts operationnels.

### Story 5.1: Configurer les bibliotheques du recap mensuel

**Requirements:** FR16

As a Administrateur,
I want choisir les bibliotheques Plex incluses dans le recap mensuel,
So that je puisse exclure certaines bibliotheques comme les series animees.

**Acceptance Criteria:**

**Given** Plex est configure
**When** l'administrateur ouvre les parametres du recap mensuel
**Then** Whatsarr affiche les bibliotheques Plex disponibles
**And** chaque bibliotheque peut etre incluse ou exclue.

**Given** l'administrateur modifie la selection
**When** il sauvegarde
**Then** le choix est persiste en base
**And** il reste disponible apres redemarrage Docker.

**Given** aucune bibliotheque n'est selectionnee
**When** le recap mensuel doit etre calcule
**Then** aucun recap n'est envoye
**And** un log indique que le recap est desactive faute de bibliotheque.

### Story 5.2: Collecter les statistiques de visionnage mensuelles

**Requirements:** FR17, NFR5

As a Administrateur,
I want que Whatsarr collecte les vues du mois precedent,
So that le recap mensuel reflete l'activite reelle du serveur.

**Acceptance Criteria:**

**Given** des bibliotheques sont selectionnees
**When** le calcul mensuel demarre
**Then** Whatsarr recupere les donnees de visionnage via Tautulli ou Plex selon la source implementee
**And** limite la periode au mois civil precedent.

**Given** un contenu appartient a une bibliotheque exclue
**When** les statistiques sont calculees
**Then** ce contenu n'est pas pris en compte.

**Given** la source de statistiques est indisponible
**When** le calcul est tente
**Then** l'echec est logge
**And** aucun message de recap incomplet n'est envoye automatiquement.

### Story 5.3: Classer films et series par utilisateurs distincts

**Requirements:** FR17

As a Administrateur,
I want classer films et series par nombre d'utilisateurs distincts,
So that le recap montre les contenus reellement populaires.

**Acceptance Criteria:**

**Given** plusieurs lectures existent pour le meme utilisateur et le meme contenu
**When** le classement est calcule
**Then** elles comptent pour un seul utilisateur distinct
**And** le nombre de lectures brutes ne remplace pas le nombre d'utilisateurs.

**Given** des films et series ont ete vus pendant le mois
**When** le classement est genere
**Then** les films et series apparaissent dans un seul resultat de recap
**And** chaque entree indique au minimum titre et nombre d'utilisateurs distincts.

**Given** aucun contenu n'a ete vu dans les bibliotheques selectionnees
**When** le recap est genere
**Then** Whatsarr produit un etat `empty`
**And** aucun message automatique n'est envoye sauf configuration future explicite.

### Story 5.4: Generer et envoyer le recap mensuel

**Requirements:** FR18, FR20

As a Administrateur,
I want que le recap mensuel soit envoye automatiquement le premier jour du mois,
So that le groupe WhatsApp recoive un resume regulier sans action manuelle.

**Acceptance Criteria:**

**Given** un classement mensuel existe
**When** le premier jour du mois arrive
**Then** Whatsarr cree un job WhatsApp de type `monthly_recap`
**And** le job cible le Groupe serveur.

**Given** le job de recap est execute
**When** le message est envoye
**Then** il utilise le template `recap mensuel`
**And** regroupe films et series dans un seul message.

**Given** un recap a deja ete envoye pour le meme mois
**When** le planificateur s'execute a nouveau
**Then** aucun second job automatique n'est cree
**And** l'evenement est journalise comme doublon evite.

### Story 5.5: Afficher le statut du recap mensuel

**Requirements:** FR18, FR19, UX-DR6

As a Administrateur,
I want voir le dernier statut du recap mensuel,
So that je sache s'il a ete envoye, ignore ou echoue.

**Acceptance Criteria:**

**Given** un recap mensuel a ete calcule ou tente
**When** l'administrateur ouvre le dashboard ou les logs
**Then** il voit le mois concerne, le statut, l'heure de calcul et l'heure d'envoi si disponible.

**Given** le recap a echoue
**When** l'administrateur consulte le statut
**Then** l'interface affiche une cause exploitable
**And** les details techniques sont disponibles dans les logs sans secret.

**Given** le recap a ete ignore
**When** la raison est affichee
**Then** l'interface indique si la cause est absence de bibliotheque, absence de vues, Groupe serveur manquant ou doublon evite.

### Story 5.6: Centraliser les logs operationnels

**Requirements:** FR19, NFR2, NFR3, UX-DR6

As a Administrateur,
I want consulter les evenements, erreurs et doublons evites,
So that je puisse comprendre le comportement de Whatsarr.

**Acceptance Criteria:**

**Given** l'application traite des evenements, jobs ou integrations
**When** un evenement important se produit
**Then** un log operationnel est cree avec niveau, type, message, horodatage et `requestId` si applicable.

**Given** l'administrateur ouvre la page Logs
**When** les logs sont charges
**Then** il peut voir les derniers evenements
**And** les entrees indiquent clairement envoye, ignore, echoue ou deduplique.

**Given** un log concerne un secret ou token
**When** il est persiste ou affiche
**Then** le secret est masque
**And** aucune cle API ou donnee de session WhatsApp n'apparait en clair.

### Story 5.7: Exposer les statuts live de l'application

**Requirements:** FR19, UX-DR7, NFR2

As a Administrateur,
I want voir les statuts live de WhatsApp, des integrations et des jobs,
So that je puisse diagnostiquer rapidement l'etat du systeme.

**Acceptance Criteria:**

**Given** l'administrateur est connecte
**When** il ouvre le dashboard
**Then** l'UI recoit les statuts live via SSE
**And** affiche l'etat WhatsApp, les integrations principales et les jobs recents.

**Given** une connexion SSE est interrompue
**When** l'UI perd les mises a jour
**Then** elle affiche un etat de reconnexion ou degradation
**And** peut recharger les derniers statuts via REST.

**Given** un statut change cote backend
**When** l'evenement SSE est envoye
**Then** l'UI met a jour l'etat sans polling rapide.
