import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MappingService } from "./mapping.service";

const now = new Date("2026-05-20T12:00:00.000Z");

describe("MappingService", () => {
  it("imports users from Overseerr first without deleting existing mappings", async () => {
    const prisma = createPrisma();
    const plex = {
      fetchUsers: vi.fn(async () => [
        { plexUserId: "plex-1", username: "alice", displayName: "Alice" }
      ])
    };
    const overseerr = {
      fetchUsers: vi.fn(async () => [
        { plexUserId: "overseerr:1", username: "alice", displayName: "Alice" }
      ])
    };
    const service = new MappingService(
      prisma as never,
      plex as never,
      overseerr as never
    );

    await service.importPlexUsers();

    expect(prisma.plexUser.upsert).toHaveBeenCalledWith({
      where: { plexUserId: "overseerr:1" },
      create: {
        plexUserId: "overseerr:1",
        username: "alice",
        displayName: "Alice",
        lastSyncedAt: expect.any(Date)
      },
      update: {
        username: "alice",
        displayName: "Alice",
        lastSyncedAt: expect.any(Date)
      }
    });
    expect(plex.fetchUsers).not.toHaveBeenCalled();
    expect(prisma.userContactMapping.delete).not.toHaveBeenCalled();
  });

  it("falls back to Plex when Overseerr import is unavailable", async () => {
    const prisma = createPrisma();
    const plex = {
      fetchUsers: vi.fn(async () => [
        { plexUserId: "plex-1", username: "alice", displayName: "Alice" }
      ])
    };
    const overseerr = { fetchUsers: vi.fn(async () => {
      throw new Error("Overseerr indisponible");
    }) };
    const service = new MappingService(
      prisma as never,
      plex as never,
      overseerr as never
    );
    const warn = vi.fn();
    (service as unknown as { logger: { warn: typeof warn } }).logger.warn = warn;

    await service.importPlexUsers();

    expect(plex.fetchUsers).toHaveBeenCalledOnce();
    expect(prisma.plexUser.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { plexUserId: "plex-1" } })
    );
    expect(warn).toHaveBeenCalledWith(
      "Import utilisateurs Overseerr indisponible, fallback Plex: Overseerr indisponible"
    );
  });

  it("prevents duplicate Plex/WhatsApp mappings", async () => {
    const prisma = createPrisma({
      plexUsers: [plexUser()],
      contacts: [contact()],
      mappings: [mapping()]
    });
    const service = createService(prisma);

    await expect(service.createMapping("plex-1", "336@g.us")).rejects.toThrow(
      ConflictException
    );
    expect(prisma.userContactMapping.create).not.toHaveBeenCalled();
  });

  it("deletes only the mapping row", async () => {
    const existing = mapping();
    const prisma = createPrisma({
      plexUsers: [plexUser()],
      contacts: [contact()],
      mappings: [existing]
    });
    const service = createService(prisma);

    await expect(service.deleteMapping("map-1")).resolves.toMatchObject({
      id: "map-1",
      plexUserId: "plex-1",
      whatsappId: "336@g.us"
    });
    expect(prisma.userContactMapping.delete).toHaveBeenCalledWith({
      where: { id: "map-1" }
    });
    expect((prisma.plexUser as Record<string, unknown>).delete).toBeUndefined();
    expect((prisma.whatsAppContact as Record<string, unknown>).delete).toBeUndefined();
  });

  it("returns every active contact linked to a Plex user", async () => {
    const prisma = createPrisma({
      plexUsers: [plexUser()],
      contacts: [
        contact({ id: "contact-1", whatsappId: "336@g.us" }),
        contact({ id: "contact-2", whatsappId: "337@g.us" })
      ],
      mappings: [
        mapping({ id: "map-1", whatsappContactId: "contact-1" }),
        mapping({ id: "map-2", whatsappContactId: "contact-2" })
      ]
    });
    const service = createService(prisma);

    await expect(service.resolveRecipients("plex-1")).resolves.toEqual([
      { whatsappId: "336@g.us", displayName: "Camille" },
      { whatsappId: "337@g.us", displayName: "Camille" }
    ]);
  });

  it("resolves Overseerr numeric ids against prefixed imported users", async () => {
    const prisma = createPrisma({
      plexUsers: [plexUser({ plexUserId: "overseerr:42", username: "alice" })],
      contacts: [contact()],
      mappings: [mapping()]
    });
    const service = createService(prisma);

    await expect(service.resolveRecipients("42")).resolves.toEqual([
      { whatsappId: "336@g.us", displayName: "Camille" }
    ]);
  });

  it("resolves Overseerr usernames against imported users", async () => {
    const prisma = createPrisma({
      plexUsers: [plexUser({ plexUserId: "overseerr:42", username: "alice" })],
      contacts: [contact()],
      mappings: [mapping()]
    });
    const service = createService(prisma);

    await expect(service.resolveRecipients("alice")).resolves.toEqual([
      { whatsappId: "336@g.us", displayName: "Camille" }
    ]);
  });

  it("logs and returns no recipient for a non-notifiable Plex user", async () => {
    const prisma = createPrisma({ plexUsers: [plexUser()] });
    const service = createService(prisma);
    const warn = vi.fn();
    (service as unknown as { logger: { warn: typeof warn } }).logger.warn = warn;

    await expect(service.resolveRecipients("plex-1")).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      "Aucun contact WhatsApp lie pour l'utilisateur Plex plex-1."
    );
  });

  it("rejects mappings with missing records", async () => {
    const service = createService(createPrisma());

    await expect(service.createMapping("missing", "336@g.us")).rejects.toThrow(
      NotFoundException
    );
  });
});

function createPlex() {
  return { fetchUsers: vi.fn(async () => []) };
}

function createOverseerr() {
  return { fetchUsers: vi.fn(async () => []) };
}

function createService(prisma: ReturnType<typeof createPrisma>) {
  return new MappingService(
    prisma as never,
    createPlex() as never,
    createOverseerr() as never
  );
}

function plexUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "plex-row-1",
    plexUserId: "plex-1",
    username: "alice",
    displayName: "Alice",
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function contact(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "contact-1",
    whatsappId: "336@g.us",
    displayName: "Camille",
    isInServerGroup: true,
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function mapping(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "map-1",
    plexUserRecordId: "plex-row-1",
    whatsappContactId: "contact-1",
    createdAt: now,
    ...overrides
  };
}

function createPrisma(
  initial: {
    plexUsers?: Array<Record<string, unknown>>;
    contacts?: Array<Record<string, unknown>>;
    mappings?: Array<Record<string, unknown>>;
  } = {}
) {
  const plexUsers = initial.plexUsers ?? [];
  const contacts = initial.contacts ?? [];
  const mappings = initial.mappings ?? [];
  const db = {
    plexUser: {
      findMany: vi.fn(async () =>
        plexUsers.map((user) => ({
          ...user,
          mappings: mappings
            .filter((item) => item.plexUserRecordId === user.id)
            .map((item) => ({
              ...item,
              whatsappContact: contacts.find(
                (contact) => contact.id === item.whatsappContactId
              )
            }))
        }))
      ),
      findUnique: vi.fn(async ({ where }) => {
        const user = plexUsers.find((item) => item.plexUserId === where.plexUserId);
        if (!user) {
          return null;
        }
        return {
          ...user,
          mappings: mappings
            .filter((item) => item.plexUserRecordId === user.id)
            .map((item) => ({
              ...item,
              whatsappContact: contacts.find(
                (contact) => contact.id === item.whatsappContactId
              )
            }))
        };
      }),
      findFirst: vi.fn(async ({ where }) => {
        const ids = new Set(where.OR[0].plexUserId.in);
        const user = plexUsers.find(
          (item) => ids.has(item.plexUserId) || item.username === where.OR[1].username
        );
        if (!user) {
          return null;
        }
        return {
          ...user,
          mappings: mappings
            .filter((item) => item.plexUserRecordId === user.id)
            .map((item) => ({
              ...item,
              whatsappContact: contacts.find(
                (contact) => contact.id === item.whatsappContactId
              )
            }))
        };
      }),
      upsert: vi.fn(async ({ create }) => create)
    },
    whatsAppContact: {
      findMany: vi.fn(async () =>
        contacts.map((contact) => ({
          ...contact,
          mappings: mappings
            .filter((item) => item.whatsappContactId === contact.id)
            .map((item) => ({
              ...item,
              plexUser: plexUsers.find((user) => user.id === item.plexUserRecordId)
            }))
        }))
      ),
      findUnique: vi.fn(async ({ where }) =>
        contacts.find((item) => item.whatsappId === where.whatsappId) ?? null
      )
    },
    userContactMapping: {
      findUnique: vi.fn(async ({ where }) => {
        const found = where.id
          ? mappings.find((item) => item.id === where.id)
          : mappings.find(
              (item) =>
                item.plexUserRecordId ===
                  where.plexUserRecordId_whatsappContactId.plexUserRecordId &&
                item.whatsappContactId ===
                  where.plexUserRecordId_whatsappContactId.whatsappContactId
            );

        if (!found) {
          return null;
        }

        return {
          ...found,
          plexUser: plexUsers.find((user) => user.id === found.plexUserRecordId),
          whatsappContact: contacts.find(
            (contact) => contact.id === found.whatsappContactId
          )
        };
      }),
      create: vi.fn(async ({ data }) => ({
        id: "map-new",
        createdAt: now,
        ...data,
        plexUser: plexUsers.find((user) => user.id === data.plexUserRecordId),
        whatsappContact: contacts.find(
          (contact) => contact.id === data.whatsappContactId
        )
      })),
      delete: vi.fn(async ({ where }) => mappings.find((item) => item.id === where.id))
    },
    $transaction: vi.fn(async (callback) => callback(db))
  };

  return db;
}
