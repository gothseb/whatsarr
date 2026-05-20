import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { EncryptionService } from "./encryption.service";
import {
  MEDIA_SERVICES,
  MediaServiceKey,
  SERVICE_LABELS,
  isMediaService
} from "./settings.constants";
import { UpdateServiceSettingsDto } from "./settings.dto";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService
  ) {}

  async listServices() {
    const rows = await this.prisma.serviceSetting.findMany();
    const byKey = new Map(rows.map((row) => [row.serviceKey, row]));

    return MEDIA_SERVICES.map((serviceKey) => {
      const row = byKey.get(serviceKey);
      return this.toPublicSettings(serviceKey, row);
    });
  }

  async updateService(serviceKey: string, payload: UpdateServiceSettingsDto) {
    const service = this.parseService(serviceKey);
    this.validatePayload(service, payload);

    const current = await this.prisma.serviceSetting.findUnique({
      where: { serviceKey: service }
    });

    const row = await this.prisma.serviceSetting.upsert({
      where: { serviceKey: service },
      create: {
        serviceKey: service,
        baseUrl: normalizeUrl(payload.baseUrl),
        apiKeyEncrypted: this.encryption.encrypt(payload.apiKey),
        usernameEncrypted: this.encryption.encrypt(payload.username),
        passwordEncrypted: this.encryption.encrypt(payload.password)
      },
      update: {
        baseUrl: normalizeUrl(payload.baseUrl),
        apiKeyEncrypted:
          payload.apiKey === undefined
            ? current?.apiKeyEncrypted
            : this.encryption.encrypt(payload.apiKey),
        usernameEncrypted:
          payload.username === undefined
            ? current?.usernameEncrypted
            : this.encryption.encrypt(payload.username),
        passwordEncrypted:
          payload.password === undefined
            ? current?.passwordEncrypted
            : this.encryption.encrypt(payload.password)
      }
    });

    return this.toPublicSettings(service, row);
  }

  async getDecryptedService(service: MediaServiceKey) {
    const row = await this.prisma.serviceSetting.findUnique({
      where: { serviceKey: service }
    });

    if (!row) {
      return null;
    }

    return {
      serviceKey: service,
      baseUrl: row.baseUrl,
      apiKey: this.encryption.decrypt(row.apiKeyEncrypted),
      username: this.encryption.decrypt(row.usernameEncrypted),
      password: this.encryption.decrypt(row.passwordEncrypted)
    };
  }

  private validatePayload(service: MediaServiceKey, payload: UpdateServiceSettingsDto) {
    if (service !== "tmdb" && !payload.baseUrl) {
      throw new BadRequestException(`${SERVICE_LABELS[service]} requiert une URL.`);
    }

    if (!payload.apiKey && payload.apiKey !== undefined) {
      throw new BadRequestException(`${SERVICE_LABELS[service]} requiert une cle API valide.`);
    }
  }

  private parseService(serviceKey: string) {
    if (!isMediaService(serviceKey)) {
      throw new NotFoundException("Service media inconnu.");
    }

    return serviceKey;
  }

  private toPublicSettings(serviceKey: MediaServiceKey, row?: ServiceSettingLike | null) {
    return {
      serviceKey,
      label: SERVICE_LABELS[serviceKey],
      baseUrl: row?.baseUrl ?? null,
      hasApiKey: Boolean(row?.apiKeyEncrypted),
      hasUsername: Boolean(row?.usernameEncrypted),
      hasPassword: Boolean(row?.passwordEncrypted),
      updatedAt: row?.updatedAt?.toISOString() ?? null
    };
  }
}

interface ServiceSettingLike {
  baseUrl: string | null;
  apiKeyEncrypted: string | null;
  usernameEncrypted: string | null;
  passwordEncrypted: string | null;
  updatedAt: Date;
}

function normalizeUrl(value?: string) {
  if (!value) {
    return null;
  }

  return value.replace(/\/+$/, "");
}
