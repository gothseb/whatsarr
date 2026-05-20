import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { TemplatesService } from "./templates.service";

const now = new Date("2026-05-20T12:00:00.000Z");

describe("TemplatesService", () => {
  it("renders a preview with sample variables", () => {
    const service = new TemplatesService(createPrisma() as never);

    expect(
      service.preview("announcement", "Titre: {{title}} / {{mediaType}}").rendered
    ).toBe("Titre: Dune: Deuxieme Partie / film");
  });

  it("rejects unknown variables before save", async () => {
    const service = new TemplatesService(createPrisma() as never);

    await expect(
      service.updateTemplate("announcement", "Titre: {{unknown}}")
    ).rejects.toThrow(BadRequestException);
  });

  it("persists default templates on first list", async () => {
    const prisma = createPrisma();
    const service = new TemplatesService(prisma as never);

    const templates = await service.listTemplates();

    expect(templates.map((template) => template.type)).toEqual([
      "announcement",
      "request_available",
      "new_episode",
      "monthly_recap"
    ]);
    expect(prisma.messageTemplate.create).toHaveBeenCalledTimes(4);
  });
});

function createPrisma() {
  const rows: Array<{
    id: string;
    templateType: string;
    body: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  return {
    messageTemplate: {
      findMany: vi.fn(async () => rows),
      findUnique: vi.fn(async ({ where }) =>
        rows.find((row) => row.templateType === where.templateType) ?? null
      ),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `tpl-${rows.length + 1}`,
          createdAt: now,
          updatedAt: now,
          ...data
        };
        rows.push(row);
        return row;
      }),
      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = rows.find((row) => row.templateType === where.templateType);
        if (existing) {
          Object.assign(existing, update, { updatedAt: now });
          return existing;
        }
        const row = {
          id: `tpl-${rows.length + 1}`,
          createdAt: now,
          updatedAt: now,
          ...create
        };
        rows.push(row);
        return row;
      })
    }
  };
}
