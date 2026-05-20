export const TEMPLATE_TYPES = [
  "announcement",
  "request_available",
  "new_episode",
  "monthly_recap"
] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const TEMPLATE_LABELS: Record<TemplateType, string> = {
  announcement: "Annonce groupe",
  request_available: "Demande disponible",
  new_episode: "Nouvel episode",
  monthly_recap: "Recap mensuel"
};

export const TEMPLATE_VARIABLES: Record<TemplateType, string[]> = {
  announcement: [
    "title",
    "mediaType",
    "releaseDate",
    "rating",
    "synopsis",
    "posterUrl",
    "source",
    "seasonNumber"
  ],
  request_available: ["userName", "title", "mediaType", "seasonNumber"],
  new_episode: [
    "userName",
    "seriesTitle",
    "seasonNumber",
    "episodeNumber",
    "episodeTitle"
  ],
  monthly_recap: [
    "month",
    "movieCount",
    "seriesCount",
    "episodeCount",
    "periodStart",
    "periodEnd",
    "periodLabel",
    "topMovies",
    "topSeries",
    "topUsers",
    "topItems"
  ]
};

export const DEFAULT_TEMPLATES: Record<TemplateType, string> = {
  announcement:
    "Nouveau sur le serveur : {{title}}\nType : {{mediaType}}\nSortie : {{releaseDate}}\nNote : {{rating}}\n{{synopsis}}",
  request_available:
    "Bonjour {{userName}}, ta demande est disponible : {{title}}.",
  new_episode:
    "Bonjour {{userName}}, nouvel episode disponible : {{seriesTitle}} S{{seasonNumber}}E{{episodeNumber}} - {{episodeTitle}}.",
  monthly_recap:
    "🔥 Classement des films et séries les plus regardés des 30 derniers jours ! 🔥\nSalut à tous !\n📢 Voici le top des films les plus visionnés sur SebFlix au cours des 30 derniers jours ({{periodLabel}}) :\n{{topMovies}}\n📢 Voici le top des séries les plus visionnées sur SebFlix au cours des 30 derniers jours ({{periodLabel}}) :\n\n{{topSeries}}\n\nBonne journée à tous"
};

export const TEMPLATE_EXAMPLES: Record<TemplateType, Record<string, string>> = {
  announcement: {
    title: "Dune: Deuxieme Partie",
    mediaType: "film",
    releaseDate: "2026-02-28",
    rating: "8.3",
    synopsis: "Paul Atreides poursuit son destin sur Arrakis.",
    posterUrl: "https://image.tmdb.org/t/p/w500/example.jpg",
    source: "overseerr",
    seasonNumber: "1"
  },
  request_available: {
    userName: "Camille",
    title: "Severance",
    mediaType: "serie",
    seasonNumber: "1"
  },
  new_episode: {
    userName: "Camille",
    seriesTitle: "Severance",
    seasonNumber: "2",
    episodeNumber: "4",
    episodeTitle: "Woe's Hollow"
  },
  monthly_recap: {
    month: "mai 2026",
    periodStart: "2026-04-01",
    periodEnd: "2026-05-01",
    periodLabel: "du 01/04/2026 au 01/05/2026",
    movieCount: "5",
    seriesCount: "5",
    episodeCount: "5",
    topMovies: "1 - Dune, vu par 4 utilisateurs\n2 - Oppenheimer, vu par 3 utilisateurs",
    topSeries: "1 - Severance, vu par 3 utilisateurs\n2 - The Last of Us, vu par 2 utilisateurs",
    topUsers: "Dune (4), Severance (3)",
    topItems: "1. Dune - 4\n2. Severance - 3"
  }
};
