import { describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";

const now = new Date("2026-05-20T12:00:00.000Z");

describe("NotificationsService", () => {
  it("deduplicates jobs by dedupe key", async () => {
    const prisma = createPrisma({
      jobs: [job({ dedupeKey: "same-key" })]
    });
    const service = createService(prisma);

    await service.createJob({
      type: "announcement",
      targetType: "group",
      targetId: "group@g.us",
      dedupeKey: "same-key",
      payload: { templateType: "announcement", variables: { title: "Dune" } }
    });

    expect(prisma.notificationJob.create).not.toHaveBeenCalled();
    expect(prisma.operationalLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: "notification.deduplicated",
        reason: "dedupe_key"
      })
    });
  });

  it("sends due jobs through the WhatsApp adapter and marks them sent", async () => {
    const prisma = createPrisma({ jobs: [job()] });
    const adapter = createAdapter();
    const service = createService(prisma, adapter);

    await service.processDueJobs();

    expect(adapter.sendMessage).toHaveBeenCalledWith(
      "group@g.us",
      "Message rendu",
      null
    );
    expect(prisma.notificationJob.update).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({ status: "sent", lastError: null })
    });
  });

  it("schedules a retry without creating another job when sending fails", async () => {
    const prisma = createPrisma({ jobs: [job()] });
    const adapter = createAdapter({ fail: true });
    const service = createService(prisma, adapter);

    await service.processDueJobs();

    expect(prisma.notificationJob.create).not.toHaveBeenCalled();
    expect(prisma.notificationJob.update).toHaveBeenLastCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "retry_scheduled",
        failedAt: null,
        lastError: "WhatsApp indisponible"
      })
    });
  });
});

function createService(prisma: ReturnType<typeof createPrisma>, adapter = createAdapter()) {
  const templates = {
    render: vi.fn(async () => "Message rendu")
  };
  return new NotificationsService(prisma as never, templates as never, adapter as never);
}

function createAdapter(options: { fail?: boolean } = {}) {
  return {
    sendMessage: vi.fn(async () => {
      if (options.fail) {
        throw new Error("WhatsApp indisponible");
      }
    })
  };
}

function job(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "job-1",
    type: "announcement",
    targetType: "group",
    targetId: "group@g.us",
    payloadJson: JSON.stringify({
      templateType: "announcement",
      variables: { title: "Dune" },
      mediaUrl: null
    }),
    status: "pending",
    attempts: 0,
    dedupeKey: "job-key",
    scheduledAt: now,
    sentAt: null,
    failedAt: null,
    lastError: null,
    requestId: "req-1",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createPrisma(initial: { jobs?: Array<Record<string, unknown>> } = {}) {
  const jobs = initial.jobs ?? [];
  const db = {
    notificationJob: {
      findUnique: vi.fn(async ({ where }) =>
        jobs.find((item) => item.dedupeKey === where.dedupeKey) ?? null
      ),
      create: vi.fn(async ({ data }) => {
        const row = job({ id: `job-${jobs.length + 1}`, ...data });
        jobs.push(row);
        return row;
      }),
      findMany: vi.fn(async () =>
        jobs.filter((item) => ["pending", "retry_scheduled"].includes(String(item.status)))
      ),
      update: vi.fn(async ({ where, data }) => {
        const row = jobs.find((item) => item.id === where.id);
        if (!row) {
          throw new Error("missing job");
        }
        if (data.attempts?.increment) {
          row.attempts = Number(row.attempts) + data.attempts.increment;
        }
        Object.assign(row, { ...data, attempts: row.attempts, updatedAt: now });
        return row;
      })
    },
    operationalLog: {
      create: vi.fn(async ({ data }) => ({
        id: "log-1",
        createdAt: now,
        ...data
      })),
      findMany: vi.fn(async () => [])
    }
  };

  return db;
}
