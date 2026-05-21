import { describe, expect, it, vi } from "vitest";
import { MediaService } from "./media.service";

const now = new Date("2026-05-20T12:00:00.000Z");

describe("MediaService", () => {
  it("uses a 6 month recent window by default", async () => {
    const service = createService(createPrisma());

    await expect(service.getRecentWindow()).resolves.toEqual({ months: 6 });
  });

  it("logs not_recent and creates no announcement for old releases", async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();
    const service = createService(prisma, notifications);

    const result = await service.routeAvailability({
      source: "overseerr",
      mediaType: "movie",
      title: "Ancien film",
      releaseDate: "2020-01-01"
    });

    expect(result.job).toBeNull();
    expect(notifications.createJob).not.toHaveBeenCalled();
    expect(notifications.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "media.availability.ignored",
        reason: "not_recent"
      })
    );
  });

  it("logs WHATSAPP_GROUP_NOT_SELECTED and creates no job when no group is configured", async () => {
    const prisma = createPrisma();
    const notifications = createNotifications();
    const service = createService(prisma, notifications);

    const result = await service.routeAvailability({
      source: "overseerr",
      mediaType: "movie",
      title: "Nouveau film",
      releaseDate: "2026-05-01"
    });

    expect(result.job).toBeNull();
    expect(notifications.createJob).not.toHaveBeenCalled();
    expect(notifications.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "announcement.skipped",
        reason: "WHATSAPP_GROUP_NOT_SELECTED"
      })
    );
  });

  it("accepts Plex movie availability from Tautulli webhooks", async () => {
    const notifications = createNotifications();
    const service = createService(
      createPrisma({ groupId: "server-group@g.us" }),
      notifications
    );

    const result = await service.routeAvailability({
      source: "plex",
      mediaType: "movie",
      title: "Dune",
      ratingKey: "123"
    });

    expect(result.job).toMatchObject({
      type: "announcement",
      targetId: "server-group@g.us"
    });
    expect(notifications.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: expect.stringContaining("availability:movie:123")
      })
    );
  });

  it("creates one request notification per linked WhatsApp contact", async () => {
    const notifications = createNotifications();
    const mapping = {
      resolveRecipients: vi.fn(async () => [
        { whatsappId: "336@g.us", displayName: "Camille" },
        { whatsappId: "337@g.us", displayName: "Camille mobile" }
      ])
    };
    const service = createService(createPrisma(), notifications, mapping);

    await service.notifyRequestAvailable({
      source: "overseerr",
      mediaType: "movie",
      title: "Dune",
      requesterPlexUserIds: ["plex-1"]
    });

    expect(notifications.createJob).toHaveBeenCalledTimes(2);
    expect(notifications.createJob).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        targetId: "336@g.us",
        dedupeKey: expect.stringContaining("336@g.us")
      })
    );
  });

  it("creates group and requester notifications from one availability webhook", async () => {
    const notifications = createNotifications();
    const mapping = {
      resolveRecipients: vi.fn(async () => [
        { whatsappId: "336@g.us", displayName: "Camille" }
      ])
    };
    const service = createService(
      createPrisma({ groupId: "server-group@g.us" }),
      notifications,
      mapping
    );

    const result = await service.routeAvailability({
      source: "overseerr",
      mediaType: "movie",
      title: "Dune",
      requesterPlexUserIds: ["alice"]
    });

    expect(result.job).toMatchObject({
      type: "announcement",
      targetId: "server-group@g.us"
    });
    expect(result.requestJobs).toHaveLength(1);
    expect(notifications.createJob).toHaveBeenCalledTimes(2);
    expect(notifications.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "request_available",
        targetId: "336@g.us"
      })
    );
    expect(mapping.resolveRecipients).toHaveBeenCalledWith("alice");
  });

  it("deduplicates the same media across Overseerr and Plex sources", async () => {
    const notifications = createNotifications();
    const service = createService(
      createPrisma({ groupId: "server-group@g.us" }),
      notifications
    );

    await service.routeAvailability({
      source: "overseerr",
      mediaType: "movie",
      title: "Dune",
      tmdbId: "693134"
    });
    const duplicate = await service.routeAvailability({
      source: "plex",
      mediaType: "movie",
      title: "Dune",
      tmdbId: "693134"
    });

    expect(duplicate.job).toBeNull();
    expect(notifications.createJob).toHaveBeenCalledTimes(1);
    expect(notifications.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "media.availability.deduplicated",
        reason: "dedupe_key"
      })
    );
  });
});

function createService(
  prisma: ReturnType<typeof createPrisma>,
  notifications = createNotifications(),
  mapping = { resolveRecipients: vi.fn(async () => []) }
) {
  const settings = {
    getDecryptedService: vi.fn(async () => null)
  };
  return new MediaService(
    prisma as never,
    notifications as never,
    settings as never,
    mapping as never
  );
}

function createNotifications() {
  return {
    createJob: vi.fn(async (input) => ({ id: "job-1", ...input })),
    log: vi.fn(async (input) => ({ id: "log-1", ...input }))
  };
}

function createPrisma({ groupId = null }: { groupId?: string | null } = {}) {
  const events: Array<Record<string, unknown>> = [];
  return {
    appSetting: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async ({ create, update }) => ({ ...create, ...update, updatedAt: now }))
    },
    mediaAvailabilityEvent: {
      findUnique: vi.fn(async ({ where }) =>
        events.find((event) => event.dedupeKey === where.dedupeKey) ?? null
      ),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `event-${events.length + 1}`,
          createdAt: now,
          ...data
        };
        events.push(row);
        return row;
      })
    },
    whatsAppServerGroup: {
      findUnique: vi.fn(async () =>
        groupId
          ? {
              id: "server",
              groupId,
              name: "Serveur",
              updatedAt: now
            }
          : null
      )
    }
  };
}
