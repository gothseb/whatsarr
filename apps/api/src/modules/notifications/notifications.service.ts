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
import { AgentImageService, isImageUrl } from "../agent/agent-image.service";
import { AgentError, AgentMessage } from "../agent/agent.types";
import { AgentNotificationPayload } from "./notifications.types";

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
    @Inject(WHATSAPP_ADAPTER) private readonly adapter: WhatsAppAdapter,
    private readonly images: AgentImageService = new AgentImageService()
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processDueJobs().catch((error) => {
        this.logger.error(`Worker notifications: ${safeErrorMessage(error)}`);
      });
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

  async createAgentJob(message: AgentMessage, requestId: string, resolveTarget: () => Promise<string>) {
    const dedupeKey = `job:agent:hermes:${message.messageId}`;
    const payload: AgentNotificationPayload = { kind: "agent_message", source: "hermes", messageId: message.messageId, text: message.text, mediaUrl: message.imageUrl ?? null };
    const replay = async (row: NonNullable<Awaited<ReturnType<typeof this.prisma.notificationJob.findUnique>>>) => {
      const original = readAgentPayload(row.payloadJson);
      if (row.type !== "agent_message" || !original || original.messageId !== message.messageId || original.text !== payload.text || original.mediaUrl !== payload.mediaUrl) {
        throw new AgentError(409, "AGENT_MESSAGE_ID_CONFLICT", "Cet identifiant correspond deja a un autre message.");
      }
      await this.log({level: "info", event: "agent.message.deduplicated", requestId, message: "Message Hermes deja accepte.", context: {source: "hermes", messageId: message.messageId, jobId: row.id, originRequestId: row.requestId}})
        .catch(() => this.logger.warn("Journalisation Hermes indisponible."));
      return { row, created: false };
    };
    const existing = await this.prisma.notificationJob.findUnique({ where: { dedupeKey } });
    if (existing) return replay(existing);
    const targetId = await resolveTarget();
    let row;
    try {
      row = await this.prisma.notificationJob.create({ data: {
        type: "agent_message", targetType: "group", targetId, payloadJson: JSON.stringify(payload), dedupeKey, scheduledAt: new Date(), requestId
      } });
    } catch (error) {
      const conflict = error as {code?: string; meta?: {target?: unknown}};
      if (conflict?.code !== "P2002") throw error;
      if (Array.isArray(conflict.meta?.target) && !conflict.meta.target.some(field => field === "dedupe_key" || field === "dedupeKey")) throw error;
      const winner = await this.prisma.notificationJob.findUnique({ where: { dedupeKey } });
      if (!winner) throw error;
      return replay(winner);
    }
    // A log outage must never turn an accepted insertion into another message.
    await this.log({level: "info", event: "agent.message.accepted", requestId, message: "Message Hermes accepte.", context: {source: "hermes", messageId: message.messageId, jobId: row.id}})
      .catch(() => this.logger.warn("Journalisation Hermes indisponible."));
    return { row, created: true };
  }

  async listJobs(limit = 50) {
    const rows = await this.prisma.notificationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100)
    });
    return rows.map((row) => this.toPublicJob(row));
  }

  async getAgentStatus(id: string) {
    const row = await this.prisma.notificationJob.findUnique({ where: { id }, select: {
      id: true, type: true, payloadJson: true, status: true, attempts: true,
      createdAt: true, sentAt: true, failedAt: true, lastError: true, requestId: true
    } });
    const payload = row?.type === "agent_message" ? readAgentPayload(row.payloadJson) : null;
    if (!row || !payload || !["pending","processing","retry_scheduled","sent","failed"].includes(row.status)) {
      throw new AgentError(404, "AGENT_MESSAGE_NOT_FOUND", "Message Hermes introuvable.");
    }
    return { jobId: row.id, messageId: payload.messageId, source: "hermes" as const,
      status: row.status, attempts: row.attempts, createdAt: row.createdAt.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null, failedAt: row.failedAt?.toISOString() ?? null,
      lastError: row.lastError ? sanitize(row.lastError) : null, requestId: row.requestId };
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
      message: sanitize(row.message),
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
        lastError: null,
        attempts: 0
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
        try {
          await this.processJob(row.id);
        } catch (error) {
          this.logger.error(`Notification ${row.id}: ${safeErrorMessage(error)}`);
        }
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

    try {
      if (row.type === "agent_message") {
        const payload = readAgentPayload(row.payloadJson);
        if (!payload) throw new Error("Contenu Hermes invalide.");
        if (payload.mediaUrl) {
          const media = await this.images.download(payload.mediaUrl);
          await this.adapter.sendMedia(row.targetId, payload.text, media);
        } else await this.adapter.sendMessage(row.targetId, payload.text, null);
      } else {
        const payload = parsePayload(row.payloadJson);
        const body = await this.templates.render(payload.templateType, payload.variables);
        await this.adapter.sendMessage(row.targetId, body, payload.mediaUrl);
      }
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
        context: { jobId: row.id, attempts: nextAttempts, ...agentLogMetadata(row) }
      });
      return;
    }

    // Once WhatsApp has accepted the message, persistence failures must not resend it.
    await this.prisma.notificationJob.update({
      where: { id },
      data: { status: "sent", sentAt: new Date(), failedAt: null, lastError: null }
    });
    await this.log({
      level: "info",
      event: "notification.sent",
      requestId: row.requestId ?? undefined,
      message: `Notification envoyee: ${row.type}`,
      context: { jobId: row.id, targetType: row.targetType, ...agentLogMetadata(row) }
    });
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
    const agent = row.type === "agent_message" ? readAgentPayload(row.payloadJson) : null;
    return {
      id: row.id,
      type: row.type,
      targetType: row.targetType,
      targetId: row.targetId,
      payload: row.type === "agent_message" ? (agent ? {kind: agent.kind, source: agent.source, messageId: agent.messageId} : null) : parseJson(row.payloadJson),
      source: agent?.source ?? null,
      messageId: agent?.messageId ?? null,
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

export function readAgentPayload(json: string): AgentNotificationPayload | null {
  const value = parseJson(json) as Partial<AgentNotificationPayload> | null;
  if (!value || value.kind !== "agent_message" || value.source !== "hermes" ||
    typeof value.messageId !== "string" || !value.messageId.trim() || value.messageId.length > 128 ||
    typeof value.text !== "string" || !value.text.trim() || value.text.length > (value.mediaUrl === null ? 4000 : 1000) ||
    (value.mediaUrl !== null && !isImageUrl(value.mediaUrl))) return null;
  return value as AgentNotificationPayload;
}

function parsePayload(value: string): NotificationPayload {
  const parsed = parseJson(value) as Partial<NotificationPayload> | null;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Contenu de notification invalide.");
  }
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
    .split("\n")[0]
    .replace(/https?:\/\/[^\s]+/gi, "[url redacted]")
    .replace(/([A-Za-z0-9+/=]{32,})/g, "[redacted]")
    .replace(/(token|api[_-]?key|password)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/(session|secret|cookie)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 500);
}

function agentLogMetadata(row: {type: string; payloadJson: string}) {
  const payload = row.type === "agent_message" ? readAgentPayload(row.payloadJson) : null;
  return payload ? {source: "hermes", messageId: payload.messageId} : {};
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
        : ["messageId", "jobId", "originRequestId"].includes(key) && typeof entry === "string" ? entry.slice(0, 128)
        : redactUnknown(entry)
    ])
  );
}
