UPDATE "message_templates"
SET "body" = '🔥 Classement des films et séries les plus regardés des 30 derniers jours ! 🔥
Salut à tous !
📢 Voici le top des films les plus visionnés sur SebFlix au cours des 30 derniers jours ({{periodLabel}}) :
{{topMovies}}
📢 Voici le top des séries les plus visionnées sur SebFlix au cours des 30 derniers jours ({{periodLabel}}) :

{{topSeries}}

Bonne journée à tous'
WHERE "template_type" = 'monthly_recap'
  AND "body" = '🔥 Classement des films et séries les plus regardés du mois dernier ! 🔥
Salut à tous !
📢 Voici le top des films les plus visionnés sur SebFlix au cours du dernier mois :
{{topMovies}}
📢 Voici le top des séries les plus visionnées sur SebFlix au cours du dernier mois :

{{topSeries}}

Bonne journée à tous';
