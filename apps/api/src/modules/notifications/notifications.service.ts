import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { TemplatesService } from "../templates/templates.service";
import { WHATSAPP_ADAPTER, WhatsAppAdapter } from "../whatsapp/whatsapp.types";
import {
  CreateLogInput,
  CreateNotificationJobInput,
  NotificationPayload
} from "./notifications.types";

const MAX_ATTEMPTS = 3;
const WORKER_INTERVAL_MS = 15_000;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    @Inject(WHATSAPP_ADAPTER) private readonly adapter: WhatsAppAdapter
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processDueJobs();
    }, WORKER_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async createJob(input: CreateNotificationJobInput) {
    const existing = await this.prisma.notificationJob.findUnique({
      where: { dedupeKey: input.dedupeKey }
    });

    if (existing) {
      await this.log({
        level: "info",
        event: "notification.deduplicated",
        reason: "dedupe_key",
        requestId: input.requestId,
        message: `Notification dedupliquee: ${input.type}`,
        context: { dedupeKey: input.dedupeKey, jobId: existing.id }
      });
      return this.toPublicJob(existing);
    }

    const row = await this.prisma.notificationJob.create({
      data: {
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId,
        payloadJson: JSON.stringify(input.payload),
        dedupeKey: input.dedupeKey,
        scheduledAt: input.scheduledAt ?? new Date(),
        requestId: input.requestId
      }
    });

    await this.log({
      level: "info",
      event: "notification.created",
      requestId: input.requestId,
      message: `Notification creee: ${input.type}`,
      context: { dedupeKey: input.dedupeKey, jobId: row.id }
    });
    return this.toPublicJob(row);
  }

  async listJobs(limit = 50) {
    const rows = await this.prisma.notificationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100)
    });
    return rows.map((row) => this.toPublicJob(row));
  }

  async listLogs(limit = 80) {
    const rows = await this.prisma.operationalLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200)
    });
    return rows.map((row) => ({
      id: row.id,
      level: row.level,
      event: row.event,
      reason: row.reason,
      message: row.message,
      requestId: row.requestId,
        context: redactUnknown(parseJson(row.contextJson)),
      createdAt: row.createdAt.toISOString()
    }));
  }

  async retryJob(id: string) {
    const row = await this.prisma.notificationJob.update({
      where: { id },
      data: {
        status: "pending",
        scheduledAt: new Date(),
        failedAt: null,
        lastError: null
      }
    });
    return this.toPublicJob(row);
  }

  async processDueJobs() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      const rows = await this.prisma.notificationJob.findMany({
        where: {
          status: { in: ["pending", "retry_scheduled"] },
          scheduledAt: { lte: new Date() }
        },
        orderBy: { scheduledAt: "asc" },
        take: 10
      });

      for (const row of rows) {
        await this.processJob(row.id);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async log(input: CreateLogInput) {
    const row = await this.prisma.operationalLog.create({
      data: {
        level: input.level,
        event: input.event,
        reason: input.reason,
        message: sanitize(input.message),
        requestId: input.requestId,
        contextJson: input.context ? JSON.stringify(redactUnknown(input.context)) : null
      }
    });

    const rendered = `${input.event}: ${sanitize(input.message)}`;
    if (input.level === "error") {
      this.logger.error(rendered);
    } else if (input.level === "warn") {
      this.logger.warn(rendered);
    } else if (input.level === "debug") {
      this.logger.debug(rendered);
    } else {
      this.logger.log(rendered);
    }

    return row;
  }

  private async processJob(id: string) {
    const row = await this.prisma.notificationJob.update({
      where: { id },
      data: {
        status: "processing",
        attempts: { increment: 1 }
      }
    });

    const payload = parsePayload(row.payloadJson);
    try {
      const body = await this.templates.render(payload.templateType, payload.variables);
      await this.adapter.sendMessage(row.targetId, body, payload.mediaUrl);
      await this.prisma.notificationJob.update({
        where: { id },
        data: {
          status: "sent",
          sentAt: new Date(),
          failedAt: null,
          lastError: null
        }
      });
      await this.log({
        level: "info",
        event: "notification.sent",
        requestId: row.requestId ?? undefined,
        message: `Notification envoyee: ${row.type}`,
        context: { jobId: row.id, targetType: row.targetType }
      });
    } catch (error) {
      const nextAttempts = row.attempts;
      const finalFailure = nextAttempts >= MAX_ATTEMPTS;
      const message = safeErrorMessage(error);
      await this.prisma.notificationJob.update({
        where: { id },
        data: {
          status: finalFailure ? "failed" : "retry_scheduled",
          scheduledAt: finalFailure
            ? row.scheduledAt
            : new Date(Date.now() + nextAttempts * 60_000),
          failedAt: finalFailure ? new Date() : null,
          lastError: message
        }
      });
      await this.log({
        level: finalFailure ? "error" : "warn",
        event: finalFailure ? "notification.failed" : "notification.retry_scheduled",
        requestId: row.requestId ?? undefined,
        message,
        context: { jobId: row.id, attempts: nextAttempts }
      });
    }
  }

  private toPublicJob(row: {
    id: string;
    type: string;
    targetType: string;
    targetId: string;
    payloadJson: string;
    status: string;
    attempts: number;
    dedupeKey: string;
    scheduledAt: Date;
    sentAt: Date | null;
    failedAt: Date | null;
    lastError: string | null;
    requestId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      type: row.type,
      targetType: row.targetType,
      targetId: row.targetId,
      payload: parseJson(row.payloadJson),
      status: row.status,
      attempts: row.attempts,
      dedupeKey: row.dedupeKey,
      scheduledAt: row.scheduledAt.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      lastError: row.lastError ? sanitize(row.lastError) : null,
      requestId: row.requestId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}

function parsePayload(value: string): NotificationPayload {
  const parsed = parseJson(value) as Partial<NotificationPayload>;
  return {
    templateType: parsed.templateType ?? "announcement",
    variables: parsed.variables ?? {},
    mediaUrl: parsed.mediaUrl ?? null
  };
}

function parseJson(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function safeErrorMessage(error: unknown) {
  return sanitize(error instanceof Error ? error.message : String(error));
}

function sanitize(value: string) {
  return value
    .replace(/([A-Za-z0-9+/=]{32,})/g, "[redacted]")
    .replace(/(token|api[_-]?key|password)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/(session|secret|cookie)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 500);
}

function redactUnknown(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitize(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      /(token|api[_-]?key|password|secret|session|cookie)/i.test(key)
        ? "[redacted]"
        : redactUnknown(entry)
    ])
  );
}
