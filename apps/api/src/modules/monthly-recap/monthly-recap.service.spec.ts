import { afterEach, describe, expect, it, vi } from "vitest";
import { MonthlyRecapService } from "./monthly-recap.service";

const now = new Date("2026-05-20T12:00:00.000Z");

describe("MonthlyRecapService", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ignores the recap and logs why when no library is selected", async () => {
    const prisma = createPrisma({ libraries: [] });
    const notifications = createNotifications();
    const service = createService(prisma, notifications);

    const status = await service.runMonthlyRecap("2026-05-01T08:00:00.000Z");

    expect(status).toMatchObject({
      month: "2026-05",
      status: "ignored",
      reason: "no_libraries"
    });
    expect(notifications.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "monthly_recap.ignored",
        reason: "no_libraries"
      })
    );
    expect(notifications.createJob).not.toHaveBeenCalled();
  });

  it("counts distinct users instead of raw plays before creating the monthly recap job", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          response: {
            data: {
              data: [
                tautulliRow({ rating_key: "m1", title: "Dune", user: "seb" }),
                tautulliRow({ rating_key: "m1", title: "Dune", user: "seb" }),
                tautulliRow({ rating_key: "m1", title: "Dune", user: "camille" }),
                tautulliRow({
                  media_type: "episode",
                  rating_key: "e1",
                  grandparent_rating_key: "s1",
                  title: "Episode 1",
                  grandparent_title: "Severance",
                  user: "seb"
                })
              ]
            }
          }
        })
      }))
    );

    const prisma = createPrisma({
      libraries: [{ plexKey: "1", title: "Films", included: true }],
      group: { groupId: "group@g.us" }
    });
    const notifications = createNotifications();
    const service = createService(prisma, notifications);

    const status = await service.runMonthlyRecap("2026-05-01T08:00:00.000Z");

    expect(status?.status).toBe("queued");
    expect(status?.ranking).toEqual([
      expect.objectContaining({
        title: "Dune",
        distinctUserCount: 2,
        rawPlayCount: 3
      }),
      expect.objectContaining({
        title: "Severance",
        distinctUserCount: 1,
        rawPlayCount: 1
      })
    ]);
    expect(notifications.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "monthly_recap",
        targetType: "group",
        targetId: "group@g.us",
        dedupeKey: "job:monthly_recap:2026-05:group:group@g.us",
        payload: expect.objectContaining({
          variables: expect.objectContaining({
            periodStart: "2026-04-01",
            periodEnd: "2026-05-01",
            periodLabel: "du 01/04/2026 au 01/05/2026",
            movieCount: 1,
            seriesCount: 1,
            topMovies: "1 - Dune, vu par 2 utilisateurs",
            topSeries: "1 - Severance, vu par 1 utilisateur"
          })
        })
      })
    );
  });

  it("runs the scheduler only on the configured day and time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 2, 7, 30, 15));

    const prisma = createPrisma({
      libraries: [],
      settings: {
        monthly_recap_day: "2",
        monthly_recap_time: "09:30"
      }
    });
    const service = createService(prisma);

    await expect(service.runScheduler()).resolves.toBeNull();

    vi.setSystemTime(new Date(2026, 4, 2, 9, 30, 15));

    await expect(service.runScheduler()).resolves.toMatchObject({
      month: "2026-05",
      status: "ignored",
      reason: "no_libraries"
    });
  });

  it("collects Tautulli history for the last 30 days, not the previous calendar month", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ response: { data: { data: [] } } })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const prisma = createPrisma({
      libraries: [{ plexKey: "1", title: "Films", included: true }]
    });
    const service = createService(prisma);

    await service.runMonthlyRecap("2026-05-15T09:30:00.000Z");

    const firstCall = fetchMock.mock.calls[0] as unknown as [URL];
    const url = new URL(String(firstCall[0]));
    expect(url.searchParams.get("after")).toBe("2026-04-15");
    expect(url.searchParams.get("before")).toBe("2026-05-15");
  });
});

function createService(
  prisma: ReturnType<typeof createPrisma>,
  notifications = createNotifications()
) {
  return new MonthlyRecapService(
    prisma as never,
    { getDecryptedService: vi.fn(async () => ({ baseUrl: "http://tautulli", apiKey: "key" })) } as never,
    { fetchLibraries: vi.fn(async () => []) } as never,
    notifications as never
  );
}

function createNotifications() {
  return {
    log: vi.fn(async () => undefined),
    createJob: vi.fn(async () => ({ id: "job-1" }))
  };
}

function createPrisma({
  libraries = [],
  group = null,
  settings = {}
}: {
  libraries?: Array<{ plexKey: string; title: string; included: boolean }>;
  group?: { groupId: string } | null;
  settings?: Record<string, string>;
}) {
  let currentRun: Record<string, unknown> | null = null;
  const appSettings = new Map(Object.entries(settings));
  return {
    monthlyRecapLibrary: {
      findMany: vi.fn(async () => libraries),
      updateMany: vi.fn(),
      upsert: vi.fn()
    },
    monthlyRecapRun: {
      findUnique: vi.fn(async () => currentRun),
      findFirst: vi.fn(async () => currentRun),
      upsert: vi.fn(async ({ create, update }) => {
        currentRun = {
          id: "run-1",
          createdAt: now,
          updatedAt: now,
          ...(currentRun ? update : create)
        };
        return currentRun;
      })
    },
    whatsAppServerGroup: {
      findUnique: vi.fn(async () =>
        group
          ? {
              id: "server",
              groupId: group.groupId,
              name: "Serveur",
              updatedAt: now
            }
          : null
      )
    },
    notificationJob: {
      findUnique: vi.fn(async () => null)
    },
    appSetting: {
      findUnique: vi.fn(async ({ where }) => {
        const value = appSettings.get(where.key);
        return value === undefined ? null : { key: where.key, value, updatedAt: now };
      }),
      upsert: vi.fn(async ({ where, create, update }) => {
        const value = update?.value ?? create.value;
        appSettings.set(where.key, value);
        return { key: where.key, value, updatedAt: now };
      })
    }
  };
}

function tautulliRow(overrides: Record<string, unknown>) {
  return {
    rating_key: "m1",
    media_type: "movie",
    title: "Dune",
    user: "seb",
    section_id: "1",
    library_name: "Films",
    ...overrides
  };
}
