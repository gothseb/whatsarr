UPDATE "message_templates"
SET "body" = '🔥 Classement des films et séries les plus regardés du mois dernier ! 🔥
Salut à tous !
📢 Voici le top des films les plus visionnés sur SebFlix au cours du dernier mois :
{{topMovies}}
📢 Voici le top des séries les plus visionnées sur SebFlix au cours du dernier mois :

{{topSeries}}

Bonne journée à tous'
WHERE "template_type" = 'monthly_recap'
  AND "body" = 'Recap {{month}}
{{movieCount}} film(s), {{episodeCount}} serie(s) dans le classement.
{{topItems}}';
