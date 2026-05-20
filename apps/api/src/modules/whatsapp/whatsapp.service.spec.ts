import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { of } from "rxjs";
import { WhatsAppService } from "./whatsapp.service";
import type { WhatsAppAdapter, WhatsAppAdapterStatus } from "./whatsapp.types";

const disconnectedStatus: WhatsAppAdapterStatus = {
  state: "disconnected",
  message: "Aucune session WhatsApp active.",
  lastChangedAt: new Date("2026-05-20T12:00:00.000Z")
};

describe("WhatsAppService", () => {
  it("requires explicit replacement when a local WhatsApp session already exists", async () => {
    const adapter = createAdapter({ hasLocalSession: true });
    const service = createService(adapter);

    await expect(service.connect(false)).rejects.toThrow(ConflictException);
    expect(adapter.initialize).not.toHaveBeenCalled();
    expect(adapter.replaceSession).not.toHaveBeenCalled();

    await service.connect(true);
    expect(adapter.replaceSession).toHaveBeenCalledOnce();
  });

  it("requires confirmation before replacing the selected server group", async () => {
    const adapter = createAdapter();
    const prisma = createPrisma({
      group: {
        id: "server",
        groupId: "old@g.us",
        name: "Ancien groupe",
        updatedAt: new Date("2026-05-20T12:00:00.000Z")
      }
    });
    const service = new WhatsAppService(prisma as never, adapter);

    await expect(
      service.selectServerGroup("new@g.us", "Nouveau groupe", false)
    ).rejects.toThrow(ConflictException);

    await expect(
      service.selectServerGroup("new@g.us", "Nouveau groupe", true)
    ).resolves.toMatchObject({
      groupId: "new@g.us",
      name: "Nouveau groupe"
    });
    expect(prisma.whatsAppServerGroup.upsert).toHaveBeenCalledOnce();
  });
});

function createAdapter(options: { hasLocalSession?: boolean } = {}): WhatsAppAdapter {
  return {
    status$: of(disconnectedStatus),
    getStatus: vi.fn(() => disconnectedStatus),
    hasLocalSession: vi.fn(() => Boolean(options.hasLocalSession)),
    initialize: vi.fn(async () => disconnectedStatus),
    replaceSession: vi.fn(async () => disconnectedStatus),
    listGroups: vi.fn(async () => []),
    listGroupMembers: vi.fn(async () => []),
    sendMessage: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined)
  };
}

function createService(adapter: WhatsAppAdapter) {
  return new WhatsAppService(createPrisma() as never, adapter);
}

function createPrisma(initial: { group?: Record<string, unknown> | null } = {}) {
  let group = initial.group ?? null;

  return {
    whatsAppServerGroup: {
      findUnique: vi.fn(async () => group),
      upsert: vi.fn(async ({ create, update }) => {
        group = {
          id: "server",
          groupId: update?.groupId ?? create.groupId,
          name: update?.name ?? create.name,
          updatedAt: new Date("2026-05-20T12:05:00.000Z")
        };
        return group;
      })
    },
    whatsAppContact: {
      findMany: vi.fn(async () => [])
    }
  };
}
