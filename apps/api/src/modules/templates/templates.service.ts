import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_EXAMPLES,
  TEMPLATE_LABELS,
  TEMPLATE_TYPES,
  TEMPLATE_VARIABLES,
  TemplateType
} from "./templates.constants";

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates() {
    await this.ensureDefaults();
    const rows = await this.prisma.messageTemplate.findMany({
      orderBy: { templateType: "asc" }
    });
    const byType = new Map(rows.map((row) => [row.templateType, row]));

    return TEMPLATE_TYPES.map((type) => {
      const row = byType.get(type);
      return {
        type,
        label: TEMPLATE_LABELS[type],
        body: row?.body ?? DEFAULT_TEMPLATES[type],
        variables: TEMPLATE_VARIABLES[type],
        updatedAt: row?.updatedAt.toISOString() ?? null
      };
    });
  }

  async updateTemplate(type: string, body: string) {
    const templateType = this.parseType(type);
    this.assertKnownVariables(templateType, body);

    const row = await this.prisma.messageTemplate.upsert({
      where: { templateType },
      create: { templateType, body },
      update: { body }
    });

    return {
      type: templateType,
      label: TEMPLATE_LABELS[templateType],
      body: row.body,
      variables: TEMPLATE_VARIABLES[templateType],
      updatedAt: row.updatedAt.toISOString()
    };
  }

  preview(type: string, body: string, variables?: Record<string, string>) {
    const templateType = this.parseType(type);
    this.assertKnownVariables(templateType, body);
    return {
      rendered: this.renderBody(body, {
        ...TEMPLATE_EXAMPLES[templateType],
        ...variables
      })
    };
  }

  async render(type: TemplateType, variables: Record<string, unknown>) {
    await this.ensureDefaults();
    const row = await this.prisma.messageTemplate.findUnique({
      where: { templateType: type }
    });
    const body = row?.body ?? DEFAULT_TEMPLATES[type];
    this.assertKnownVariables(type, body);
    return this.renderBody(body, stringifyVariables(variables));
  }

  parseType(type: string): TemplateType {
    if (!TEMPLATE_TYPES.includes(type as TemplateType)) {
      throw new NotFoundException("Template inconnu.");
    }
    return type as TemplateType;
  }

  private async ensureDefaults() {
    const existing = await this.prisma.messageTemplate.findMany({
      select: { templateType: true }
    });
    const existingTypes = new Set(existing.map((row) => row.templateType));

    for (const type of TEMPLATE_TYPES) {
      if (!existingTypes.has(type)) {
        await this.prisma.messageTemplate.create({
          data: {
            templateType: type,
            body: DEFAULT_TEMPLATES[type]
          }
        });
      }
    }
  }

  private assertKnownVariables(type: TemplateType, body: string) {
    const allowed = new Set(TEMPLATE_VARIABLES[type]);
    const unknown = Array.from(extractVariables(body)).filter(
      (name) => !allowed.has(name)
    );

    if (unknown.length > 0) {
      throw new BadRequestException(
        `Variable invalide pour ${TEMPLATE_LABELS[type]}: ${unknown.join(", ")}`
      );
    }
  }

  private renderBody(body: string, variables: Record<string, string>) {
    return body.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, name: string) =>
      variables[name] ?? ""
    );
  }
}

function extractVariables(body: string) {
  const variables = new Set<string>();
  for (const match of body.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) {
    variables.add(match[1]);
  }
  return variables;
}

function stringifyVariables(variables: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, value == null ? "" : String(value)])
  );
}
