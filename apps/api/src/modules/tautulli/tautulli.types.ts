export interface AgentHistoryQuery {
  offset: number;
  limit: number;
  userId?: string;
  from?: string;
  to?: string;
}
export interface AgentHistoryItem {
  userId: string | null;
  userName: string | null;
  title: string | null;
  mediaType: "movie" | "episode" | "track" | "live" | "collection" | "playlist" | null;
  ratingKey: string | null;
  libraryKey: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  durationSeconds: number | null;
  progressPercent: number | null;
  seriesTitle: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
}
