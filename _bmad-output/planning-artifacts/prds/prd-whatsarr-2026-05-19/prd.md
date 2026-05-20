---
title: "PRD: whatsarr"
status: draft
created: 2026-05-19
updated: 2026-05-20
---

# PRD: whatsarr

## 0. Document Purpose

Ce PRD decrit la V1 de Whatsarr pour guider la conception UX, l'architecture et la decoupe en epics/stories. Il part du brief produit cree le 2026-05-19 et formalise les exigences fonctionnelles, les limites MVP, les risques et les questions ouvertes. Le niveau de rigueur vise un projet personnel self-hosted, mais avec assez de precision pour produire une implementation fiable.

## 1. Vision

Whatsarr est une application Docker personnelle qui connecte un serveur Plex et son ecosysteme media a WhatsApp. Elle permet a l'administrateur d'un serveur Plex de communiquer automatiquement avec les membres de son groupe WhatsApp: annonces de nouveautes recentes, notifications individuelles lorsqu'une demande est disponible, alertes de nouveaux episodes, et recap mensuel des contenus les plus vus.

Le pari produit est simple: les evenements existent deja dans Plex, Tautulli, Overseerr, Radarr et Sonarr, mais les utilisateurs finaux regardent surtout WhatsApp. Whatsarr transforme donc ces signaux techniques en messages lisibles, personnalises et utiles, envoyes depuis le compte WhatsApp de l'administrateur.

La V1 doit rester volontairement simple: un administrateur, un serveur Plex principal, une session WhatsApp Web, un groupe WhatsApp cible, des mappings Plex vers contacts WhatsApp, et des automatisations de notification robustes.

## 2. Target User

### 2.1 Primary Persona

**Administrateur Plex personnel** - Une personne qui gere un serveur Plex partage avec famille, amis ou petite communaute privee. Elle utilise deja ou prevoit d'utiliser des outils comme Radarr, Sonarr, Overseerr et Tautulli. Elle veut eviter les annonces manuelles et garder ses utilisateurs informes dans WhatsApp.

### 2.2 Jobs To Be Done

- Configurer en un seul endroit les acces aux services media du serveur.
- Connecter son compte WhatsApp personnel sans passer par l'API Meta Business.
- Choisir le groupe WhatsApp officiel du serveur Plex.
- Associer les membres WhatsApp du groupe aux utilisateurs Plex.
- Automatiser les annonces utiles sans spammer le groupe.
- Notifier les bonnes personnes individuellement quand un contenu les concerne.
- Resumer chaque mois les contenus les plus vus sur les bibliotheques Plex choisies.

### 2.3 Non-Users (v1)

- Administrateurs qui veulent gerer plusieurs serveurs Plex ou plusieurs comptes WhatsApp.
- Equipes multi-admin avec roles, permissions et audit avance.
- Utilisateurs qui veulent une API WhatsApp officielle Meta Business.
- Communautes publiques ou usages commerciaux.

### 2.4 Key User Journeys

- **UJ-1. L'administrateur configure Whatsarr.** L'administrateur installe le conteneur Docker, ouvre l'interface web, renseigne les URL et cles API de Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB, puis teste chaque connexion. Le systeme affiche l'etat de chaque integration et sauvegarde la configuration de maniere persistante.
- **UJ-2. L'administrateur connecte WhatsApp et choisit le groupe serveur.** Depuis l'interface, l'administrateur lance la connexion WhatsApp Web, scanne le QR code, voit la session passer en connectee, consulte la liste de ses groupes WhatsApp, puis marque un groupe comme groupe du serveur.
- **UJ-3. L'administrateur mappe les contacts WhatsApp aux utilisateurs Plex.** Whatsarr importe les membres du groupe WhatsApp et les utilisateurs Plex. L'administrateur associe chaque utilisateur Plex a un ou plusieurs contacts WhatsApp. La valeur est livree quand les notifications individuelles peuvent cibler les bons contacts.
- **UJ-4. Whatsarr annonce une nouveaute recente dans le groupe.** Quand Overseerr signale un film ou une premiere saison disponible, ou quand Plex signale le premier ou les premiers episodes d'une saison 2+, Whatsarr enrichit le contenu via TMDB, verifie que la sortie est dans la fenetre recente configuree, puis publie automatiquement dans le groupe WhatsApp avec affiche, titre francais, pitch et note si disponible.
- **UJ-5. Whatsarr notifie individuellement un contenu attendu.** Lorsqu'une demande Overseerr de film ou de saison 1 devient disponible, ou qu'un evenement Plex signale une nouvelle saison ou un nouvel episode, Whatsarr identifie les utilisateurs concernes via demandes/suivis et historique de visionnage, puis envoie un message individuel a chaque contact WhatsApp lie.
- **UJ-6. Whatsarr envoie le recap mensuel.** Le premier jour du mois, Whatsarr calcule les films et series les plus vus sur les bibliotheques Plex selectionnees, classe les resultats par nombre d'utilisateurs distincts, puis publie un message unique dans le groupe WhatsApp.

## 3. Glossary

- **Administrateur** - Personne unique qui configure Whatsarr et dont le compte WhatsApp envoie les messages.
- **Bibliotheque Plex** - Section Plex configurable, par exemple films, series TV ou series anime.
- **Contact WhatsApp** - Participant WhatsApp pouvant recevoir un message individuel.
- **Demande** - Requete de contenu faite par un utilisateur, principalement via Overseerr.
- **Groupe serveur** - Groupe WhatsApp choisi par l'administrateur comme canal collectif du serveur Plex.
- **Nouvelle disponibilite** - Contenu detecte comme disponible par la source de verite adaptee: Overseerr pour films et saison 1, Plex pour saisons 2+ et nouveaux episodes.
- **Nouveaute recente** - Film ou serie dont la date de sortie TMDB est dans la fenetre configurable, 6 mois par defaut.
- **Recap mensuel** - Message groupe envoye le premier jour du mois avec films et series les plus vus.
- **Session WhatsApp Web** - Connexion WhatsApp pilotee par Whatsarr comme un navigateur web, sans API Meta.
- **Template de message** - Texte configurable utilise pour un type d'envoi automatique.
- **Utilisateur Plex** - Compte Plex ayant acces au serveur.

## 4. Features

### 4.1 Configuration des services media

**Description:** L'Administrateur configure les integrations depuis une page Parametres simple inspiree Overseerr/Radarr. Chaque integration affiche son etat et un bouton de test. Realise UJ-1.

**Functional Requirements:**

#### FR-1: Configurer les acces services

L'Administrateur peut renseigner et modifier les URL, cles API et secrets necessaires pour Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB.

**Consequences testables:**
- Les valeurs sont sauvegardees dans le stockage persistant du conteneur.
- Le redemarrage Docker ne supprime pas la configuration.
- Les secrets ne sont pas affiches en clair apres sauvegarde, sauf action volontaire de remplacement.

#### FR-2: Tester les connexions

L'Administrateur peut tester chaque integration separement.

**Consequences testables:**
- Chaque service affiche un statut connecte, erreur d'authentification, inaccessible ou non configure.
- En cas d'erreur, l'interface affiche un message exploitable sans exposer le secret.

### 4.2 Session WhatsApp Web

**Description:** Whatsarr fournit sa propre connexion WhatsApp Web, similaire en experience a WAHA mais sans dependre de WAHA ni de l'API Meta. Realise UJ-2.

**Functional Requirements:**

#### FR-3: Connecter WhatsApp via QR code

L'Administrateur peut demarrer une session WhatsApp Web et scanner un QR code depuis l'interface.

**Consequences testables:**
- L'interface affiche l'etat de session: non connectee, QR requis, connectee, erreur, deconnectee.
- Une session connectee permet de lister les groupes WhatsApp.

#### FR-4: Persister la session WhatsApp

Whatsarr conserve l'etat necessaire pour restaurer la session WhatsApp Web apres redemarrage Docker.

**Consequences testables:**
- Apres redemarrage du conteneur avec volume persistant, la session tente de se restaurer automatiquement.
- Si WhatsApp invalide la session, l'interface demande une nouvelle connexion QR.

#### FR-5: Gerer une seule session WhatsApp

Whatsarr supporte exactement une Session WhatsApp Web en V1.

**Consequences testables:**
- L'interface ne propose pas de multi-session.
- Une nouvelle connexion remplace la session existante apres confirmation.

### 4.3 Groupe serveur et mapping utilisateurs

**Description:** L'Administrateur choisit le Groupe serveur, importe ses membres, importe les Utilisateurs Plex, puis cree les associations necessaires aux messages individuels. Realise UJ-2 et UJ-3.

**Functional Requirements:**

#### FR-6: Selectionner le Groupe serveur

L'Administrateur peut voir la liste des groupes WhatsApp accessibles a la Session WhatsApp Web et choisir le Groupe serveur.

**Consequences testables:**
- Le groupe selectionne est conserve apres redemarrage.
- Le changement de Groupe serveur demande confirmation.

#### FR-7: Importer les membres WhatsApp

Whatsarr recupere les Contact WhatsApp du Groupe serveur.

**Consequences testables:**
- La liste affiche nom, identifiant WhatsApp et etat de mapping.
- Un rafraichissement manuel met a jour les membres ajoutes ou retires.

#### FR-8: Mapper Utilisateur Plex vers Contact WhatsApp

L'Administrateur peut associer un Utilisateur Plex a un ou plusieurs Contact WhatsApp.

**Consequences testables:**
- Un Utilisateur Plex peut avoir zero, un ou plusieurs Contact WhatsApp.
- Un message individuel destine a cet Utilisateur Plex est envoye a tous ses Contact WhatsApp lies.
- Les utilisateurs sans contact lie sont signales comme non notifiables.

### 4.4 Templates de messages

**Description:** L'Administrateur peut modifier les textes types pour chaque categorie d'envoi automatique. Realise UJ-4, UJ-5 et UJ-6.

**Functional Requirements:**

#### FR-9: Modifier les Templates de message

L'Administrateur peut modifier les templates pour annonce groupe, demande disponible, nouvel episode et Recap mensuel.

**Consequences testables:**
- Chaque template accepte des variables documentees, par exemple titre, date, note, synopsis, utilisateur, saison, episode.
- Un apercu de template peut etre genere avec des donnees d'exemple.
- Un template invalide indique les variables inconnues avant sauvegarde.

### 4.5 Annonces de nouveautes recentes

**Description:** Whatsarr detecte les nouvelles disponibilites depuis la source de verite adaptee, enrichit les contenus via TMDB, filtre selon la fenetre recente, puis publie dans le Groupe serveur. Realise UJ-4.

**Functional Requirements:**

#### FR-10: Detecter les nouvelles disponibilites selon la source de verite

Whatsarr detecte les disponibilites a annoncer dans le groupe avec Overseerr comme source de verite pour les films et la premiere saison d'une serie, et Plex comme source de verite pour les premiers episodes des saisons suivantes, a partir de la saison 2.

**Consequences testables:**
- Un contenu deja annonce n'est pas republie en double.
- Le systeme conserve un historique minimal des annonces envoyees.
- Les episodes individuels d'une saison deja annoncee ne declenchent pas une annonce groupe de nouvelle serie.
- Le ou les premiers episodes d'une saison 2+ peuvent declencher une annonce de nouvelle saison dedupliquee au niveau serie/saison.

#### FR-11: Enrichir via TMDB

Whatsarr recupere les metadonnees TMDB utiles pour les messages.

**Consequences testables:**
- Pour un film ou une serie reconnue, le message peut inclure titre francais, affiche, synopsis, date de sortie et note si disponible.
- Si TMDB ne trouve pas de correspondance fiable, Whatsarr peut envoyer un message degrade avec les donnees Plex, ou bloquer selon un reglage futur. [ASSUMPTION: la V1 autorise le message degrade.]
- L'interface inclut une attribution TMDB conforme dans une section A propos ou Parametres.

#### FR-12: Filtrer les sorties recentes

Whatsarr annonce dans le Groupe serveur uniquement les Nouveautes recentes.

**Consequences testables:**
- La fenetre recente vaut 6 mois par defaut.
- L'Administrateur peut modifier cette fenetre.
- Un contenu dont la date de sortie est hors fenetre n'est pas annonce dans le groupe.

#### FR-13: Publier une annonce groupe riche

Whatsarr envoie automatiquement dans le Groupe serveur une annonce pour chaque Nouveaute recente eligible.

**Consequences testables:**
- Le message utilise le Template de message annonce groupe.
- Le message peut inclure une affiche lorsque disponible.
- L'echec d'envoi est journalise et peut etre retente selon la strategie de file d'attente. [ASSUMPTION: la V1 inclut une file simple avec retry manuel ou automatique limite.]

### 4.6 Notifications individuelles

**Description:** Whatsarr envoie des messages directs aux Contact WhatsApp lies lorsqu'un contenu concerne un Utilisateur Plex. Realise UJ-5.

**Functional Requirements:**

#### FR-14: Notifier une Demande disponible

Quand une Demande devient disponible, Whatsarr identifie l'Utilisateur Plex demandeur et envoie un message a tous ses Contact WhatsApp lies. Overseerr est la source de verite pour les demandes de films et de saison 1; Plex prend le relais pour les nouvelles saisons et ajouts d'episodes qui ne sont pas suivis par Overseerr.

**Consequences testables:**
- Le message utilise le Template de message demande disponible.
- Si l'utilisateur n'a aucun contact lie, l'evenement est journalise comme non notifie.
- L'envoi ne depend pas de l'annonce groupe.
- Les demandes issues d'Overseerr restent liees au demandeur meme lorsque Plex confirme ensuite la disponibilite d'une saison 2+ ou d'un episode.

#### FR-15: Notifier un nouvel episode aux spectateurs et demandeurs

Quand un nouvel episode est disponible, Whatsarr utilise Plex comme source de verite et notifie les Utilisateurs Plex qui ont regarde la serie et ceux qui l'ont demandee ou suivie.

**Consequences testables:**
- Le ciblage deduplique les utilisateurs presents dans plusieurs sources.
- Tous les Contact WhatsApp lies a chaque Utilisateur Plex recoivent le message.
- Le message inclut au minimum nom de serie, saison, episode et disponibilite.
- Les nouveaux episodes d'une saison en cours et les nouvelles saisons ne dependent pas d'Overseerr pour declencher la notification.

### 4.7 Recap mensuel

**Description:** Le premier jour du mois, Whatsarr publie un message unique films + series avec les contenus les plus vus du mois precedent, sur les Bibliotheques Plex choisies. Realise UJ-6.

**Functional Requirements:**

#### FR-16: Configurer les bibliotheques du Recap mensuel

L'Administrateur peut choisir quelles Bibliotheques Plex alimentent le Recap mensuel.

**Consequences testables:**
- Une Bibliotheque Plex peut etre incluse ou exclue du Recap mensuel.
- Le choix est persistant.

#### FR-17: Calculer les contenus les plus vus

Whatsarr calcule les films et series les plus vus par nombre d'Utilisateurs Plex distincts.

**Consequences testables:**
- Le classement ne compte pas plusieurs lectures du meme utilisateur comme plusieurs utilisateurs.
- Les films et series apparaissent dans le meme message.
- Le calcul couvre le mois civil precedent.

#### FR-18: Envoyer le Recap mensuel automatiquement

Whatsarr envoie le Recap mensuel dans le Groupe serveur le premier jour du mois.

**Consequences testables:**
- Le message utilise le Template de message Recap mensuel.
- Un recap deja envoye pour un mois donne n'est pas envoye deux fois automatiquement.
- L'Administrateur peut voir le dernier statut d'envoi.

### 4.8 Journalisation et suivi operationnel

**Description:** L'interface reste simple mais doit permettre de comprendre ce qui s'est passe: connexions, derniers evenements, derniers messages, erreurs. Realise tous les UJ.

**Functional Requirements:**

#### FR-19: Afficher les derniers messages et erreurs

L'Administrateur peut consulter les derniers envois, evenements ignores et erreurs.

**Consequences testables:**
- Chaque entree indique type d'evenement, cible, statut, horodatage et cause d'erreur si applicable.
- Les doublons evites sont visibles comme tels.

#### FR-20: Eviter les doublons

Whatsarr conserve assez d'etat pour eviter de renvoyer plusieurs fois le meme message automatique.

**Consequences testables:**
- Un meme contenu recent ne cree pas plusieurs annonces groupe.
- Une meme disponibilite de demande ne cree pas plusieurs messages individuels.
- Un meme recap mensuel n'est pas renvoye automatiquement plusieurs fois.

## 5. Non-Goals (Explicit)

- Pas de support multi-admin en V1.
- Pas de support multi-session WhatsApp en V1.
- Pas de multi-serveur Plex en V1.
- Pas d'API Meta WhatsApp Business.
- Pas de bot conversationnel WhatsApp complet.
- Pas de remplacement complet de Radarr, Sonarr, Overseerr ou Tautulli.
- Pas de recommandations personnalisees complexes.
- Pas d'usage commercial ou communautaire public cible en V1.

## 6. MVP Scope

### 6.1 In Scope

- Application web self-hosted installable via Docker.
- Stockage persistant de la configuration, de la session WhatsApp Web et de l'historique minimal.
- Parametrage Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB.
- Connexion WhatsApp Web par QR code.
- Selection d'un Groupe serveur.
- Import membres WhatsApp et Utilisateurs Plex.
- Mapping Utilisateur Plex vers un ou plusieurs Contact WhatsApp.
- Templates modifiables pour les messages automatiques.
- Annonces groupe pour Nouveautes recentes avec seuil configurable, sourcees depuis Overseerr pour films/saison 1 et Plex pour saisons 2+.
- Messages individuels pour Demande disponible, sourcees depuis Overseerr pour films/saison 1 et completees par Plex pour saisons 2+.
- Messages individuels pour nouvel episode aux spectateurs et demandeurs/suiveurs, sourcees depuis Plex.
- Recap mensuel unique films + series, configurable par Bibliotheque Plex.
- Logs simples, statuts de connexion et protection anti-doublons.

### 6.2 Out of Scope for MVP

- Gestion avancee des permissions.
- Moderation ou validation manuelle avant envoi.
- Workflows d'approbation de messages.
- Editeur visuel avance des templates.
- Analytics detaillees au-dela du Recap mensuel.
- Application mobile dediee.

## 7. Success Metrics

**Primary**

- **SM-1:** Installation et configuration reussies - L'Administrateur peut connecter Plex, TMDB et WhatsApp, choisir un Groupe serveur et sauvegarder la configuration apres redemarrage. Valide FR-1 a FR-8.
- **SM-2:** Notifications utiles sans intervention - Une Nouveaute recente, une Demande disponible, un nouvel episode et un Recap mensuel peuvent etre envoyes automatiquement sans action manuelle apres configuration. Valide FR-10 a FR-18.
- **SM-3:** Pas de spam involontaire - Le meme evenement ne declenche pas plusieurs messages automatiques. Valide FR-20.

**Secondary**

- **SM-4:** Maintenance acceptable - L'Administrateur peut diagnostiquer l'etat WhatsApp, les integrations et les erreurs depuis l'interface. Valide FR-2, FR-3, FR-19.

**Counter-metrics**

- **SM-C1:** Nombre total de messages envoyes - Ne pas optimiser pour envoyer plus; l'objectif est d'envoyer les bons messages aux bonnes personnes.
- **SM-C2:** Richesse visuelle des messages - Ne pas bloquer la notification uniquement parce qu'une affiche ou une note manque, sauf decision contraire future.

## 8. Cross-Cutting NFRs

- **Fiabilite:** Les redemarrages Docker ne doivent pas effacer la configuration, les mappings, l'historique anti-doublon ou la session WhatsApp lorsque celle-ci reste valide.
- **Observabilite:** Les evenements entrants, decisions de filtrage, envois, echecs et doublons evites doivent etre journalises.
- **Confidentialite:** Les cles API, tokens, identifiants WhatsApp et mappings utilisateur/contact sont des donnees sensibles et ne doivent pas etre exposes inutilement dans l'interface ou les logs.
- **Simplicite UI:** L'interface doit rester proche des conventions Overseerr/Radarr: navigation claire, pages de configuration, etats de connexion, listes editables, logs lisibles.
- **Degradation:** Quand un service secondaire est indisponible, Whatsarr doit expliquer ce qui est bloque ou degrade plutot que produire un comportement silencieux.

## 9. Risks and Mitigations

- **R-1: WhatsApp Web est fragile.** Le fonctionnement peut casser si WhatsApp change son client web ou invalide les sessions. Mitigation: isoler le composant WhatsApp, afficher l'etat de session, journaliser les erreurs, prevoir reconnexion QR.
- **R-2: Risque de spam ou doublons.** Des webhooks ou scans repetes peuvent renvoyer le meme message. Mitigation: historique anti-doublon par type d'evenement, contenu, cible et periode.
- **R-3: Matching TMDB imparfait.** Un contenu Plex ou Overseerr peut etre mal associe. Mitigation: utiliser les IDs externes disponibles lorsque possible, sinon degrade ou marquer incertain.
- **R-4: Mapping humain incomplet.** Certains Utilisateurs Plex n'auront pas de Contact WhatsApp lie. Mitigation: surface "non notifiables" et logs d'evenements non envoyes.
- **R-5: Donnees d'historique variables.** Le ciblage des spectateurs depend de Plex/Tautulli et des historiques disponibles. Mitigation: documenter la source utilisee et afficher les limites.
- **R-6: Routage de source mal applique.** Une nouveaute peut etre annoncee depuis la mauvaise source, par exemple une saison 2 detectee comme saison 1. Mitigation: centraliser la regle de routage dans le backend et journaliser la source retenue pour chaque evenement.

## 10. Open Questions

1. Quelle librairie ou moteur WhatsApp Web sera utilise pour piloter la session dans Docker?
2. Faut-il privilegier Tautulli ou Plex directement pour l'historique de visionnage et les statistiques mensuelles?
3. Comment distinguer techniquement la premiere saison d'une serie des saisons 2+ dans les payloads disponibles, en particulier lorsqu'un import Plex ajoute plusieurs episodes ou saisons d'un coup?
4. Quelle strategie de retry appliquer aux messages WhatsApp echoues: manuel uniquement, automatique limite, ou file persistante complete?
5. Pour les series, le Recap mensuel doit-il classer au niveau serie seulement, ou distinguer aussi les episodes/saisons les plus vus?
6. Quelle limite de taille appliquer aux messages WhatsApp avec affiche et synopsis pour eviter des publications trop longues?

## 11. Assumptions Index

- FR-11: La V1 autorise un message degrade avec donnees Plex quand TMDB ne trouve pas de correspondance fiable.
- FR-13: La V1 inclut une file simple avec retry manuel ou automatique limite.
- FR-10/FR-14/FR-15: La V1 centralise le routage des sources de verite dans le backend: Overseerr pour films/saison 1, Plex pour saisons 2+ et episodes individuels.
