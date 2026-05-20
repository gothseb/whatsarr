import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PlexLibrary, PlexService } from "../plex/plex.service";
import { SettingsService } from "../settings/settings.service";

const SCHEDULER_INTERVAL_MS = 60 * 1000;
const HISTORY_PAGE_SIZE = 1000;
const MONTHLY_RECAP_DAY_KEY = "monthly_recap_day";
const MONTHLY_RECAP_TIME_KEY = "monthly_recap_time";
const DEFAULT_MONTHLY_RECAP_DAY = 1;
const DEFAULT_MONTHLY_RECAP_TIME = "09:00";

type RecapStatus =
  | "queued"
  | "sent"
  | "failed"
  | "ignored"
  | "empty";

interface TautulliHistoryItem {
  ratingKey: string;
  grandparentRatingKey: string | null;
  mediaType: string;
  title: string;
  grandparentTitle: string | null;
  user: string;
  libraryKey: string | null;
  libraryTitle: string | null;
}

interface RankingEntry {
  key: string;
  title: string;
  mediaType: "movie" | "series";
  distinctUserCount: number;
  rawPlayCount: number;
}

@Injectable()
export class MonthlyRecapService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly plex: PlexService,
    private readonly notifications: NotificationsService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.runScheduler();
    }, SCHEDULER_INTERVAL_MS);
    void this.runScheduler();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async listLibraries() {
    await this.syncPlexLibraries();
    const rows = await this.prisma.monthlyRecapLibrary.findMany({
      orderBy: { title: "asc" }
    });
    return {
      items: rows.map((row) => ({
        plexKey: row.plexKey,
        title: row.title,
        type: row.type,
        included: row.included,
        lastSyncedAt: row.lastSyncedAt.toISOString()
      }))
    };
  }

  async updateLibraries(includedLibraryKeys: string[]) {
    const included = new Set(includedLibraryKeys);
    await this.prisma.monthlyRecapLibrary.updateMany({
      data: { included: false }
    });

    for (const plexKey of included) {
      await this.prisma.monthlyRecapLibrary.upsert({
        where: { plexKey },
        create: {
          plexKey,
          title: plexKey,
          type: null,
          included: true,
          lastSyncedAt: new Date()
        },
        update: { included: true }
      });
    }

    await this.notifications.log({
      level: "info",
      event: "monthly_recap.libraries_updated",
      message: `${included.size} bibliotheque(s) active(s) pour le recap mensuel.`,
      context: { includedLibraryKeys: Array.from(included) }
    });

    return this.listLibraries();
  }

  async getSchedule() {
    const [dayRow, timeRow] = await Promise.all([
      this.prisma.appSetting.findUnique({ where: { key: MONTHLY_RECAP_DAY_KEY } }),
      this.prisma.appSetting.findUnique({ where: { key: MONTHLY_RECAP_TIME_KEY } })
    ]);

    return normalizeSchedule(dayRow?.value, timeRow?.value);
  }

  async updateSchedule(dayOfMonth: number, time: string) {
    const schedule = normalizeSchedule(String(dayOfMonth), time);
    await Promise.all([
      this.prisma.appSetting.upsert({
        where: { key: MONTHLY_RECAP_DAY_KEY },
        create: { key: MONTHLY_RECAP_DAY_KEY, value: String(schedule.dayOfMonth) },
        update: { value: String(schedule.dayOfMonth) }
      }),
      this.prisma.appSetting.upsert({
        where: { key: MONTHLY_RECAP_TIME_KEY },
        create: { key: MONTHLY_RECAP_TIME_KEY, value: schedule.time },
        update: { value: schedule.time }
      })
    ]);

    await this.notifications.log({
      level: "info",
      event: "monthly_recap.schedule_updated",
      message: `Recap mensuel planifie le ${schedule.dayOfMonth} a ${schedule.time}.`,
      context: schedule
    });

    return schedule;
  }

  async getLatestStatus() {
    const row = await this.prisma.monthlyRecapRun.findFirst({
      orderBy: { calculatedAt: "desc" }
    });

    if (!row) {
      return null;
    }

    const job = row.jobId
      ? await this.prisma.notificationJob.findUnique({ where: { id: row.jobId } })
      : null;
    const status = this.resolveRunStatus(row.status as RecapStatus, job?.status);

    return {
      id: row.id,
      month: row.month,
      status,
      reason: row.reason,
      source: row.source,
      ranking: parseRanking(row.rankingJson),
      jobId: row.jobId,
      requestId: row.requestId,
      calculatedAt: row.calculatedAt.toISOString(),
      sentAt: job?.sentAt?.toISOString() ?? row.sentAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async runScheduler() {
    const now = new Date();
    const schedule = await this.getSchedule();
    const [hour, minute] = schedule.time.split(":").map(Number);
    const scheduledDay = Math.min(schedule.dayOfMonth, lastDayOfMonth(now));
    if (
      now.getDate() !== scheduledDay ||
      now.getHours() !== hour ||
      now.getMinutes() !== minute
    ) {
      return null;
    }
    return this.runMonthlyRecap(now.toISOString());
  }

  async runMonthlyRecap(referenceDate?: string) {
    const requestId = randomUUID();
    const reference = parseReferenceDate(referenceDate);
    const period = lastThirtyDays(reference);
    const existing = await this.prisma.monthlyRecapRun.findUnique({
      where: { month: period.month }
    });

    if (existing?.jobId || existing?.status === "sent" || existing?.status === "queued") {
      await this.notifications.log({
        level: "info",
        event: "monthly_recap.deduplicated",
        reason: "duplicate_month",
        requestId,
        message: `Recap mensuel deja prepare pour ${period.month}.`,
        context: { month: period.month, runId: existing.id, jobId: existing.jobId }
      });
      return this.getLatestStatus();
    }

    const libraries = await this.prisma.monthlyRecapLibrary.findMany({
      where: { included: true }
    });

    if (libraries.length === 0) {
      await this.notifications.log({
        level: "warn",
        event: "monthly_recap.ignored",
        reason: "no_libraries",
        requestId,
        message: "Recap mensuel desactive: aucune bibliotheque selectionnee."
      });
      await this.upsertRun(period.month, "ignored", "no_libraries", [], requestId);
      return this.getLatestStatus();
    }

    let ranking: RankingEntry[];
    try {
      const history = await this.fetchTautulliHistory(period.start, period.end);
      ranking = this.rankHistory(history, libraries);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Source de statistiques indisponible.";
      await this.notifications.log({
        level: "error",
        event: "monthly_recap.failed",
        reason: "stats_source_unavailable",
        requestId,
        message
      });
      await this.upsertRun(period.month, "failed", "stats_source_unavailable", [], requestId);
      return this.getLatestStatus();
    }

    if (ranking.length === 0) {
      await this.notifications.log({
        level: "info",
        event: "monthly_recap.empty",
        reason: "no_views",
        requestId,
        message: `Aucune vue a recapitulatif pour ${period.month}.`
      });
      await this.upsertRun(period.month, "empty", "no_views", [], requestId);
      return this.getLatestStatus();
    }

    const group = await this.prisma.whatsAppServerGroup.findUnique({
      where: { id: "server" }
    });
    if (!group) {
      await this.notifications.log({
        level: "warn",
        event: "monthly_recap.ignored",
        reason: "missing_server_group",
        requestId,
        message: "Recap mensuel ignore: aucun Groupe serveur selectionne.",
        context: { month: period.month }
      });
      await this.upsertRun(period.month, "ignored", "missing_server_group", ranking, requestId);
      return this.getLatestStatus();
    }

    const movies = ranking.filter((entry) => entry.mediaType === "movie");
    const series = ranking.filter((entry) => entry.mediaType === "series");
    const job = await this.notifications.createJob({
      type: "monthly_recap",
      targetType: "group",
      targetId: group.groupId,
      requestId,
      dedupeKey: `job:monthly_recap:${period.month}:group:${group.groupId}`,
      payload: {
        templateType: "monthly_recap",
        variables: {
          month: formatMonthLabel(period.month),
          periodStart: formatDate(period.start),
          periodEnd: formatDate(period.end),
          periodLabel: formatPeriodLabel(period.start, period.end),
          movieCount: movies.length,
          seriesCount: series.length,
          episodeCount: series.length,
          topMovies: formatTopSection(movies, "Aucun film vu sur la periode."),
          topSeries: formatTopSection(series, "Aucune serie vue sur la periode."),
          topUsers: ranking
            .slice(0, 5)
            .map((entry) => `${entry.title} (${entry.distinctUserCount})`)
            .join(", "),
          topItems: ranking
            .slice(0, 10)
            .map((entry, index) => `${index + 1}. ${entry.title} - ${entry.distinctUserCount}`)
            .join("\n")
        }
      }
    });

    await this.upsertRun(period.month, "queued", null, ranking, requestId, job.id);
    return this.getLatestStatus();
  }

  private async syncPlexLibraries() {
    let libraries: PlexLibrary[];
    try {
      libraries = await this.plex.fetchLibraries();
    } catch (error) {
      await this.notifications.log({
        level: "warn",
        event: "monthly_recap.libraries_sync_failed",
        reason: "plex_unavailable",
        message: error instanceof Error ? error.message : "Plex indisponible."
      });
      return;
    }

    const now = new Date();
    for (const library of libraries) {
      await this.prisma.monthlyRecapLibrary.upsert({
        where: { plexKey: library.key },
        create: {
          plexKey: library.key,
          title: library.title,
          type: library.type,
          included: true,
          lastSyncedAt: now
        },
        update: {
          title: library.title,
          type: library.type,
          lastSyncedAt: now
        }
      });
    }
  }

  private async fetchTautulliHistory(start: Date, end: Date) {
    const settings = await this.settings.getDecryptedService("tautulli");
    if (!settings?.baseUrl || !settings.apiKey) {
      throw new BadRequestException("Tautulli n'est pas configure.");
    }

    const items: TautulliHistoryItem[] = [];
    let startIndex = 0;
    while (true) {
      const url = new URL("/api/v2", settings.baseUrl);
      url.searchParams.set("apikey", settings.apiKey);
      url.searchParams.set("cmd", "get_history");
      url.searchParams.set("after", formatDate(start));
      url.searchParams.set("before", formatDate(end));
      url.searchParams.set("start", String(startIndex));
      url.searchParams.set("length", String(HISTORY_PAGE_SIZE));

      const response = await fetch(url);
      if (!response.ok) {
        throw new BadRequestException("Tautulli a refuse l'historique de visionnage.");
      }

      const body = (await response.json()) as Record<string, unknown>;
      const page = readTautulliRows(body).map(normalizeHistoryItem);
      items.push(...page);
      if (page.length < HISTORY_PAGE_SIZE) {
        break;
      }
      startIndex += HISTORY_PAGE_SIZE;
    }

    return items;
  }

  private rankHistory(history: TautulliHistoryItem[], libraries: Array<{ plexKey: string; title: string }>) {
    const libraryKeys = new Set(libraries.map((library) => library.plexKey));
    const libraryTitles = new Set(libraries.map((library) => library.title.toLowerCase()));
    const byContent = new Map<
      string,
      RankingEntry & { users: Set<string> }
    >();

    for (const item of history) {
      const libraryMatches =
        (item.libraryKey ? libraryKeys.has(item.libraryKey) : false) ||
        (item.libraryTitle ? libraryTitles.has(item.libraryTitle.toLowerCase()) : false);
      if (!libraryMatches) {
        continue;
      }
      if (!item.user || !item.ratingKey) {
        continue;
      }

      const mediaType = item.mediaType === "movie" ? "movie" : "series";
      const key = mediaType === "series" ? item.grandparentRatingKey ?? item.ratingKey : item.ratingKey;
      const title = mediaType === "series" ? item.grandparentTitle ?? item.title : item.title;
      const current =
        byContent.get(key) ??
        ({
          key,
          title,
          mediaType,
          distinctUserCount: 0,
          rawPlayCount: 0,
          users: new Set<string>()
        } satisfies RankingEntry & { users: Set<string> });

      current.rawPlayCount += 1;
      current.users.add(item.user);
      current.distinctUserCount = current.users.size;
      byContent.set(key, current);
    }

    return Array.from(byContent.values())
      .map(({ users: _users, ...entry }) => entry)
      .sort(
        (a, b) =>
          b.distinctUserCount - a.distinctUserCount ||
          b.rawPlayCount - a.rawPlayCount ||
          a.title.localeCompare(b.title)
      )
      .slice(0, 20);
  }

  private async upsertRun(
    month: string,
    status: RecapStatus,
    reason: string | null,
    ranking: RankingEntry[],
    requestId: string,
    jobId?: string
  ) {
    return this.prisma.monthlyRecapRun.upsert({
      where: { month },
      create: {
        month,
        status,
        reason,
        rankingJson: JSON.stringify(ranking),
        jobId,
        requestId,
        calculatedAt: new Date()
      },
      update: {
        status,
        reason,
        rankingJson: JSON.stringify(ranking),
        jobId,
        requestId,
        calculatedAt: new Date()
      }
    });
  }

  private resolveRunStatus(status: RecapStatus, jobStatus?: string) {
    if (jobStatus === "sent") {
      return "sent";
    }
    if (jobStatus === "failed") {
      return "failed";
    }
    return status;
  }
}

function readTautulliRows(body: Record<string, unknown>) {
  const response = readRecord(body.response);
  const data = readRecord(response.data ?? body.data);
  return readArray(data.data ?? data.history ?? response.data ?? body.data);
}

function normalizeHistoryItem(row: unknown): TautulliHistoryItem {
  const item = readRecord(row);
  return {
    ratingKey: String(item.rating_key ?? item.ratingKey ?? ""),
    grandparentRatingKey: readNullableString(item.grandparent_rating_key ?? item.grandparentRatingKey),
    mediaType: String(item.media_type ?? item.mediaType ?? item.type ?? ""),
    title: String(item.full_title ?? item.title ?? ""),
    grandparentTitle: readNullableString(item.grandparent_title ?? item.grandparentTitle),
    user: String(item.user ?? item.username ?? item.friendly_name ?? ""),
    libraryKey: readNullableString(item.section_id ?? item.library_section_id ?? item.libraryKey),
    libraryTitle: readNullableString(item.library_name ?? item.section_title ?? item.libraryTitle)
  };
}

function lastThirtyDays(reference: Date) {
  const end = new Date(reference);
  const start = new Date(reference);
  start.setDate(start.getDate() - 30);
  return {
    month: `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}`,
    start,
    end
  };
}

function parseReferenceDate(value?: string) {
  if (!value) {
    return new Date();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException("referenceDate invalide.");
  }
  return date;
}

function normalizeSchedule(dayValue?: string | null, timeValue?: string | null) {
  const parsedDay = Number(dayValue ?? DEFAULT_MONTHLY_RECAP_DAY);
  const dayOfMonth =
    Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 31
      ? parsedDay
      : DEFAULT_MONTHLY_RECAP_DAY;
  const time =
    typeof timeValue === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)
      ? timeValue
      : DEFAULT_MONTHLY_RECAP_TIME;

  return {
    dayOfMonth,
    time
  };
}

function lastDayOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
}

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, monthNumber - 1, 1));
}

function formatPeriodLabel(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  return `du ${formatter.format(start)} au ${formatter.format(end)}`;
}

function formatTopSection(entries: RankingEntry[], emptyMessage: string) {
  const topEntries = entries.slice(0, 5);
  if (topEntries.length === 0) {
    return emptyMessage;
  }

  return topEntries
    .map(
      (entry, index) =>
        `${index + 1} - ${entry.title}, vu par ${entry.distinctUserCount} ${pluralizeUsers(entry.distinctUserCount)}`
    )
    .join("\n");
}

function pluralizeUsers(count: number) {
  return count > 1 ? "utilisateurs" : "utilisateur";
}

function parseRanking(value: string): RankingEntry[] {
  try {
    const parsed = JSON.parse(value) as RankingEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
