export const MEDIA_SERVICES = [
  "plex",
  "tautulli",
  "overseerr",
  "radarr",
  "sonarr",
  "tmdb"
] as const;

export type MediaServiceKey = (typeof MEDIA_SERVICES)[number];

export const SERVICE_LABELS: Record<MediaServiceKey, string> = {
  plex: "Plex",
  tautulli: "Tautulli",
  overseerr: "Overseerr",
  radarr: "Radarr",
  sonarr: "Sonarr",
  tmdb: "TMDB"
};

export function isMediaService(value: string): value is MediaServiceKey {
  return MEDIA_SERVICES.includes(value as MediaServiceKey);
}
