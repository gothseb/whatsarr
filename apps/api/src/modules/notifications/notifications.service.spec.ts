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

  it.each(["invalid-json", "null", "[]"])("handles malformed payload %s without blocking other jobs", async (payloadJson) => {
    const invalid = job({ payloadJson });
    const valid = job({ id: "job-2" });
    const prisma = createPrisma({ jobs: [invalid, valid] });
    const adapter = createAdapter();

    await createService(prisma, adapter).processDueJobs();

    expect(invalid.status).toBe("retry_scheduled");
    expect(invalid.lastError).toBe("Contenu de notification invalide.");
    expect(valid.status).toBe("sent");
    expect(adapter.sendMessage).toHaveBeenCalledOnce();
  });

  it("does not resend a sent message when logging fails and continues the batch", async () => {
    const first = job();
    const second = job({ id: "job-2" });
    const prisma = createPrisma({ jobs: [first, second] });
    prisma.operationalLog.create.mockRejectedValueOnce(new Error("Database unavailable"));
    const adapter = createAdapter();
    const service = createService(prisma, adapter);

    await service.processDueJobs();
    await service.processDueJobs();

    expect(first.status).toBe("sent");
    expect(second.status).toBe("sent");
    expect(adapter.sendMessage).toHaveBeenCalledTimes(2);
  });

  it.each(["announcement", "request_available", "new_episode", "monthly_recap"])("keeps legacy template %s", async type => {
    const prisma=createPrisma({jobs:[job({type,payloadJson:JSON.stringify({templateType:type,variables:{title:"Dune"}})})]});
    const templates={render:vi.fn(async()=>"rendered")};const adapter=createAdapter();
    await new NotificationsService(prisma as never,templates as never,adapter as never).processDueJobs();
    expect(templates.render).toHaveBeenCalledWith(type,{title:"Dune"});
    expect(adapter.sendMessage).toHaveBeenCalledWith("group@g.us","rendered",null);
  });
  it("sends Hermes literal text without templates and keeps retry budget",async()=>{
    const row=job({type:"agent_message",attempts:2,payloadJson:JSON.stringify({kind:"agent_message",source:"hermes",messageId:"a",text:"{{title}}\n hello ",mediaUrl:null})});
    const prisma=createPrisma({jobs:[row]});const adapter=createAdapter({fail:true});const templates={render:vi.fn()};
    await new NotificationsService(prisma as never,templates as never,adapter as never).processDueJobs();
    expect(templates.render).not.toHaveBeenCalled();
    expect(adapter.sendMessage).toHaveBeenCalledWith("group@g.us","{{title}}\n hello ",null);
    expect(row.status).toBe("failed");expect(row.attempts).toBe(3);
  });
  it("does not pick up uncertain processing Hermes jobs",async()=>{
    const adapter=createAdapter();await createService(createPrisma({jobs:[job({status:"processing",type:"agent_message"})]}),adapter).processDueJobs();
    expect(adapter.sendMessage).not.toHaveBeenCalled();
  });

  it("sends controlled Hermes media once with no text fallback",async()=>{
    const payload={kind:"agent_message",source:"hermes",messageId:"a",text:"caption",mediaUrl:"http://hermes/p.png"};
    const row=job({type:"agent_message",payloadJson:JSON.stringify(payload)});const prisma=createPrisma({jobs:[row]});const adapter=createAdapter();
    const media={data:Buffer.from([1,2]),mimetype:"image/png",filename:"x.png",filesize:2};const images={download:vi.fn(async()=>media)};
    const service=new NotificationsService(prisma as never,{render:vi.fn()} as never,adapter as never,images as never);
    prisma.operationalLog.create.mockRejectedValueOnce(new Error("log outage"));await service.processDueJobs();await service.processDueJobs();
    expect(images.download).toHaveBeenCalledOnce();expect(adapter.sendMedia).toHaveBeenCalledWith("group@g.us","caption",media);expect(adapter.sendMessage).not.toHaveBeenCalled();expect(row.status).toBe("sent");
  });
  it("fails media with retries but never falls back to text",async()=>{
    const row=job({type:"agent_message",attempts:2,payloadJson:JSON.stringify({kind:"agent_message",source:"hermes",messageId:"a",text:"caption",mediaUrl:"http://hermes/p.png"})});const adapter=createAdapter();
    const images={download:vi.fn(async()=>{throw new Error("AGENT_IMAGE_INVALID");})};
    await new NotificationsService(createPrisma({jobs:[row]}) as never,{render:vi.fn()} as never,adapter as never,images as never).processDueJobs();
    expect(row.status).toBe("failed");expect(row.attempts).toBe(3);expect(row.lastError).toBe("AGENT_IMAGE_INVALID");expect(adapter.sendMessage).not.toHaveBeenCalled();expect(adapter.sendMedia).not.toHaveBeenCalled();
  });
  it("resets the attempt budget for a manual retry", async () => {
    const failed = job({ status: "failed", attempts: 3 });
    const prisma = createPrisma({ jobs: [failed] });
    const service = createService(prisma, createAdapter({ fail: true }));

    await service.retryJob("job-1");
    await service.processDueJobs();

    expect(failed.attempts).toBe(1);
    expect(failed.status).toBe("retry_scheduled");
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
    sendMedia: vi.fn(async()=>{}),
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
        const attempts = data.attempts?.increment
          ? Number(row.attempts) + data.attempts.increment
          : data.attempts ?? row.attempts;
        Object.assign(row, { ...data, attempts, updatedAt: now });
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
