import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { MappingService } from "../mapping/mapping.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SettingsService } from "../settings/settings.service";
import { MediaAvailabilityDto } from "./media.dto";

const RECENT_WINDOW_KEY = "recent_window_months";
const DEFAULT_RECENT_WINDOW_MONTHS = 6;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly mapping: MappingService
  ) {}

  async getRecentWindow() {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: RECENT_WINDOW_KEY }
    });
    return {
      months: Number(row?.value ?? DEFAULT_RECENT_WINDOW_MONTHS)
    };
  }

  async updateRecentWindow(months: number) {
    const row = await this.prisma.appSetting.upsert({
      where: { key: RECENT_WINDOW_KEY },
      create: { key: RECENT_WINDOW_KEY, value: String(months) },
      update: { value: String(months) }
    });
    return { months: Number(row.value) };
  }

  async routeAvailability(input: MediaAvailabilityDto) {
    const requestId = randomUUID();
    const routed = this.normalizeAvailability(input);
    const dedupeKey = this.availabilityDedupeKey(routed);

    const existing = await this.prisma.mediaAvailabilityEvent.findUnique({
      where: { dedupeKey }
    });
    if (existing) {
      await this.notifications.log({
        level: "info",
        event: "media.availability.deduplicated",
        reason: "dedupe_key",
        requestId,
        message: `Disponibilite dedupliquee: ${routed.title}`,
        context: { dedupeKey }
      });
      const requestJobs = await this.createRequestAvailableJobs(routed);
      return { event: this.toPublicEvent(existing), job: null, requestJobs };
    }

    const enriched = await this.enrichMedia(routed, requestId);
    const row = await this.prisma.mediaAvailabilityEvent.create({
      data: {
        source: routed.source,
        eventType: routed.eventType,
        mediaType: routed.mediaType,
        title: enriched.title,
        ratingKey: routed.ratingKey,
        tmdbId: enriched.tmdbId ?? routed.tmdbId,
        seasonNumber: routed.seasonNumber,
        episodeNumber: routed.episodeNumber,
        releaseDate: parseDate(enriched.releaseDate ?? routed.releaseDate),
        dedupeKey,
        payloadJson: JSON.stringify(enriched)
      }
    });

    const recent = await this.isRecent(enriched.releaseDate ?? routed.releaseDate);
    if (!recent) {
      await this.notifications.log({
        level: "info",
        event: "media.availability.ignored",
        reason: "not_recent",
        requestId,
        message: `Disponibilite ignoree car hors fenetre recente: ${enriched.title}`,
        context: { dedupeKey }
      });
      return { event: this.toPublicEvent(row), job: null };
    }

    const requestJobs = await this.createRequestAvailableJobs(routed);
    const group = await this.prisma.whatsAppServerGroup.findUnique({
      where: { id: "server" }
    });
    if (!group) {
      await this.notifications.log({
        level: "error",
        event: "announcement.skipped",
        reason: "WHATSAPP_GROUP_NOT_SELECTED",
        requestId,
        message: "WHATSAPP_GROUP_NOT_SELECTED",
        context: { dedupeKey }
      });
      return { event: this.toPublicEvent(row), job: null, requestJobs };
    }

    const job = await this.notifications.createJob({
      type: "announcement",
      targetType: "group",
      targetId: group.groupId,
      requestId,
      dedupeKey: `job:announcement:${dedupeKey}:group:${group.groupId}`,
      payload: {
        templateType: "announcement",
        mediaUrl: enriched.posterUrl ?? null,
        variables: {
          title: enriched.title,
          mediaType: labelMediaType(routed.mediaType),
          releaseDate: enriched.releaseDate ?? "",
          rating: enriched.rating ?? "",
          synopsis: enriched.synopsis ?? "",
          posterUrl: enriched.posterUrl ?? "",
          source: routed.source,
          seasonNumber: routed.seasonNumber ?? ""
        }
      }
    });

    return { event: this.toPublicEvent(row), job, requestJobs };
  }

  async notifyRequestAvailable(input: MediaAvailabilityDto) {
    return { jobs: await this.createRequestAvailableJobs(input) };
  }

  async notifyNewEpisode(input: MediaAvailabilityDto) {
    const users = unique([
      ...(input.requesterPlexUserIds ?? []),
      ...(input.viewerPlexUserIds ?? [])
    ]);

    if (input.mediaType === "episode" && (input.seasonNumber ?? 0) >= 2) {
      await this.routeAvailability({
        ...input,
        source: "plex",
        mediaType: "season",
        episodeNumber: undefined
      });
    }

    return this.createContactJobs(input, users, "new_episode");
  }

  private async createRequestAvailableJobs(input: MediaAvailabilityDto) {
    const users = unique(input.requesterPlexUserIds ?? []);
    if (users.length === 0) {
      return [];
    }

    return (await this.createContactJobs(input, users, "request_available")).jobs;
  }

  private async createContactJobs(
    input: MediaAvailabilityDto,
    plexUserIds: string[],
    templateType: "request_available" | "new_episode"
  ) {
    const requestId = randomUUID();
    const jobs = [];

    for (const plexUserId of plexUserIds) {
      const recipients = await this.mapping.resolveRecipients(plexUserId);
      if (recipients.length === 0) {
        await this.notifications.log({
          level: "warn",
          event: "notification.skipped",
          reason: "user_not_notifiable",
          requestId,
          message: `Utilisateur Plex non notifiable: ${plexUserId}`,
          context: { plexUserId }
        });
        continue;
      }

      for (const recipient of recipients) {
        jobs.push(
          await this.notifications.createJob({
            type: templateType,
            targetType: "contact",
            targetId: recipient.whatsappId,
            requestId,
            dedupeKey: `job:${templateType}:${dedupeMediaId(input)}:${recipient.whatsappId}`,
            payload: {
              templateType,
              variables:
                templateType === "new_episode"
                  ? {
                      userName: recipient.displayName,
                      seriesTitle: input.title,
                      seasonNumber: input.seasonNumber ?? "",
                      episodeNumber: input.episodeNumber ?? "",
                      episodeTitle: input.episodeTitle ?? `Episode ${input.episodeNumber ?? ""}`
                    }
                  : {
                      userName: recipient.displayName,
                      title: input.title,
                      mediaType: labelMediaType(input.mediaType),
                      seasonNumber: input.seasonNumber ?? ""
                    }
            }
          })
        );
      }
    }

    return { jobs };
  }

  private normalizeAvailability(input: MediaAvailabilityDto) {
    if (input.source === "overseerr") {
      if (input.mediaType === "movie" || (input.seasonNumber ?? 1) <= 1) {
        return { ...input, source: "overseerr" as const, eventType: "media.availability.routed" };
      }
      throw new BadRequestException("Overseerr ne route que les films et saisons 1.");
    }

    if (
      input.mediaType === "episode" ||
      input.mediaType === "season" ||
      (input.seasonNumber ?? 0) >= 2
    ) {
      return { ...input, source: "plex" as const, eventType: "media.availability.routed" };
    }

    throw new BadRequestException("Plex est requis pour les saisons 2+ et episodes.");
  }

  private availabilityDedupeKey(input: MediaAvailabilityDto & { eventType: string }) {
    return [
      "availability",
      input.source,
      input.mediaType,
      dedupeMediaId(input),
      input.seasonNumber ?? 0
    ].join(":");
  }

  private async isRecent(releaseDate?: string) {
    if (!releaseDate) {
      return true;
    }

    const parsed = parseDate(releaseDate);
    if (!parsed) {
      return true;
    }

    const { months } = await this.getRecentWindow();
    const threshold = new Date();
    threshold.setMonth(threshold.getMonth() - months);
    return parsed >= threshold;
  }

  private async enrichMedia(
    input: MediaAvailabilityDto & { eventType: string },
    requestId: string
  ) {
    const settings = await this.settings.getDecryptedService("tmdb");
    if (!settings?.apiKey) {
      await this.notifications.log({
        level: "warn",
        event: "media.enrichment.degraded",
        reason: "tmdb_not_configured",
        requestId,
        message: `Enrichissement TMDB degrade pour ${input.title}`
      });
      return input;
    }

    try {
      const result = input.tmdbId
        ? await this.fetchTmdbById(settings.apiKey, input)
        : await this.searchTmdb(settings.apiKey, input);
      if (!result) {
        await this.notifications.log({
          level: "warn",
          event: "media.enrichment.degraded",
          reason: "tmdb_no_match",
          requestId,
          message: `Aucune correspondance TMDB fiable pour ${input.title}`
        });
        return input;
      }
      return { ...input, ...result };
    } catch (error) {
      await this.notifications.log({
        level: "warn",
        event: "media.enrichment.degraded",
        reason: "tmdb_unreachable",
        requestId,
        message: error instanceof Error ? error.message : "TMDB inaccessible"
      });
      return input;
    }
  }

  private async fetchTmdbById(apiKey: string, input: MediaAvailabilityDto) {
    const type = input.mediaType === "movie" ? "movie" : "tv";
    const url = new URL(`https://api.themoviedb.org/3/${type}/${input.tmdbId}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", "fr-FR");
    return this.readTmdbDetails(url, type, input.tmdbId);
  }

  private async searchTmdb(apiKey: string, input: MediaAvailabilityDto) {
    const type = input.mediaType === "movie" ? "movie" : "tv";
    const url = new URL(`https://api.themoviedb.org/3/search/${type}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", "fr-FR");
    url.searchParams.set("query", input.title);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("TMDB a refuse la recherche.");
    }
    const body = (await response.json()) as { results?: Array<Record<string, unknown>> };
    const first = body.results?.[0];
    return first ? normalizeTmdb(first, type) : null;
  }

  private async readTmdbDetails(url: URL, type: "movie" | "tv", tmdbId?: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("TMDB a refuse l'enrichissement.");
    }
    return normalizeTmdb((await response.json()) as Record<string, unknown>, type, tmdbId);
  }

  private toPublicEvent(row: {
    id: string;
    source: string;
    eventType: string;
    mediaType: string;
    title: string;
    seasonNumber: number | null;
    episodeNumber: number | null;
    dedupeKey: string;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      source: row.source,
      eventType: row.eventType,
      mediaType: row.mediaType,
      title: row.title,
      seasonNumber: row.seasonNumber,
      episodeNumber: row.episodeNumber,
      dedupeKey: row.dedupeKey,
      createdAt: row.createdAt.toISOString()
    };
  }
}

function normalizeTmdb(
  item: Record<string, unknown>,
  type: "movie" | "tv",
  explicitId?: string
) {
  const posterPath = readString(item.poster_path);
  return {
    tmdbId: explicitId ?? String(item.id ?? ""),
    title: readString(type === "movie" ? item.title : item.name) ?? "",
    posterUrl: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : undefined,
    synopsis: readString(item.overview),
    releaseDate: readString(type === "movie" ? item.release_date : item.first_air_date),
    rating: typeof item.vote_average === "number" ? item.vote_average.toFixed(1) : undefined
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim())));
}

function dedupeMediaId(input: Pick<MediaAvailabilityDto, "tmdbId" | "ratingKey" | "title" | "seasonNumber" | "episodeNumber">) {
  return [
    input.tmdbId ?? input.ratingKey ?? input.title.toLowerCase().replace(/\s+/g, "-"),
    input.seasonNumber ?? 0,
    input.episodeNumber ?? 0
  ].join(":");
}

function labelMediaType(value: string) {
  if (value === "movie") {
    return "film";
  }
  if (value === "episode") {
    return "episode";
  }
  return "serie";
}
