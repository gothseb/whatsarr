export interface AgentCatalogueQuery {
  offset: number;
  limit: number;
  libraryKey?: string;
  mediaType?: "movie" | "series";
}
export interface AgentMediaQuery extends AgentCatalogueQuery {
  q: string;
}
export interface AgentMediaItem {
  ratingKey: string;
  libraryKey: string;
  title: string;
  mediaType: "movie" | "series";
  year: number | null;
  summary: string | null;
  genres: string[];
  addedAt: string | null;
}

export interface AgentRecentQuery {
  offset: number;
  limit: number;
  libraryKey?: string;
  mediaType?: "movie" | "series" | "episode";
}
export interface AgentRecentItem extends Omit<AgentMediaItem,"mediaType"> {
  mediaType: "movie" | "series" | "episode";
  releaseDate: string | null;
  seriesTitle: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
}
