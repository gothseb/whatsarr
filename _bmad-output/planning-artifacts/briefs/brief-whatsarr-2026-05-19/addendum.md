# Addendum: notes de decouverte

## Brain dump utilisateur du 2026-05-19

Objectif: creer un programme installable en Docker, dans l'esprit de Radarr, Sonarr et Overseerr, pour connecter les logiciels d'un serveur multimedia: Plex, Radarr, Sonarr, Overseerr, Tautulli, TMDB et WhatsApp.

Le produit doit permettre:

- Ajouter une cle TMDB.
- Connecter un compte WhatsApp comme dans WAHA - WhatsApp HTTP API.
- Creer une connexion WhatsApp dans l'application.
- Garder cette connexion active meme si le conteneur Docker redemarre.
- Retrouver le groupe WhatsApp dedie au serveur Plex.
- Recuperer les contacts du groupe.
- Faire le lien entre les contacts WhatsApp et les identifiants utilisateurs Plex.
- Supporter plusieurs contacts WhatsApp pour un seul utilisateur Plex.
- Publier dans un groupe WhatsApp dedie au serveur Plex.
- Envoyer des messages individuels a un contact associe a un utilisateur Plex.

Cas d'usage identifies:

- Annoncer dans le groupe WhatsApp qu'un nouveau film ou une nouvelle serie est disponible sur Plex.
- Considerer un contenu comme recent si sa date de sortie est inferieure a 6 mois.
- Utiliser TMDB pour recuperer la date de sortie, le titre francais, l'affiche, le pitch et la note si disponible.
- Envoyer un message individuel lorsqu'une demande faite par un utilisateur Plex est disponible.
- Envoyer un message individuel a tous ceux qui regardent une serie lorsqu'un nouvel episode arrive.

## Notes de recherche rapide

- WAHA expose des sessions WhatsApp et une API de QR code; sa documentation indique que la sauvegarde d'etat et l'autostart apres redemarrage existent via WAHA Plus et/ou stockage de session configure.
- Overseerr supporte les notifications Webhook avec payload JSON personnalisable.
- Plex expose des webhooks pour nouveaux contenus et evenements de lecture, mais les webhooks Plex sont une fonctionnalite Plex Pass.
- Tautulli supporte des agents de notification, dont Webhook, et dispose de triggers lies aux contenus ajoutes et a l'activite Plex.
- TMDB expose des endpoints de recherche, details, dates de sortie, traductions, images et identifiants externes; l'utilisation de ses donnees/images impose une attribution.

## Arbitrages utilisateur du 2026-05-19

- Usage uniquement personnel, pas besoin de viser tout de suite un produit public ou open-source generique.
- L'application doit quand meme avoir une page Parametres pour renseigner les acces aux services multimedia: URL, cles API et autres secrets necessaires.
- WAHA est seulement une reference d'experience. Whatsarr ne doit pas dependre de WAHA ni de l'API Meta.
- Whatsarr doit fournir son propre serveur web et connecter WhatsApp comme un navigateur WhatsApp Web.
- La session WhatsApp doit rester active apres redemarrage Docker.
- Avant correction du 2026-05-20, Plex avait ete note comme source principale souhaitee pour detecter les contenus disponibles, notamment les nouveaux episodes.
- Les notifications d'episodes doivent cibler les utilisateurs qui ont regarde la serie et ceux qui l'ont demandee/suivie.
- Les envois doivent etre automatiques.
- Il faut prevoir une page pour modifier les textes types de chaque type d'envoi.
- Chaque premier du mois, l'application doit envoyer un recap des films ou series les plus vus, en comptant le nombre d'utilisateurs distincts.
- Le recap mensuel doit permettre de choisir les bibliotheques/dossiers concernes, par exemple inclure "series TV" mais exclure "series anime".
- V1 mono-admin, mono-session WhatsApp.
- L'application doit lister les groupes WhatsApp du compte connecte, permettre de definir le groupe concerne, recuperer les membres du groupe, puis les lier aux utilisateurs Plex.

## Arbitrages complementaires du 2026-05-19

- Le recap mensuel doit contenir les films et les series dans le meme message.
- Les annonces de groupe doivent concerner uniquement les sorties recentes.
- Le seuil "recent" est de 6 mois par defaut, mais doit etre configurable.
- Si un utilisateur Plex a plusieurs contacts WhatsApp lies, chaque contact doit recevoir le message individuel.
- L'interface doit rester simple, dans l'esprit Overseerr/Radarr.

## Correction de source de verite du 2026-05-20

- Pour les publications dans le groupe WhatsApp, Overseerr est la source de verite pour les films et pour la premiere saison d'une serie.
- Pour les publications dans le groupe WhatsApp concernant les saisons suivantes, a partir de la saison 2, Plex est la source de verite lorsque le ou les premiers episodes de la nouvelle saison arrivent.
- Pour les messages individuels, la meme logique s'applique: Overseerr pour les demandes films et saison 1, Plex pour les nouvelles saisons et les nouveaux episodes.
- Exception explicite: les messages individuels pour les nouveaux episodes d'une saison en cours utilisent Plex comme source de verite, car Overseerr ne suit pas les ajouts d'episodes individuels ni les nouvelles saisons.
