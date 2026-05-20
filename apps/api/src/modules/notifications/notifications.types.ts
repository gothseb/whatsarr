import type { TemplateType } from "../templates/templates.constants";

export type NotificationJobType =
  | "announcement"
  | "request_available"
  | "new_episode"
  | "monthly_recap";

export type NotificationTargetType = "group" | "contact";

export interface NotificationPayload {
  templateType: TemplateType;
  variables: Record<string, unknown>;
  mediaUrl?: string | null;
}

export interface CreateNotificationJobInput {
  type: NotificationJobType;
  targetType: NotificationTargetType;
  targetId: string;
  payload: NotificationPayload;
  dedupeKey: string;
  scheduledAt?: Date;
  requestId?: string;
}

export interface CreateLogInput {
  level: "debug" | "info" | "warn" | "error";
  event: string;
  message: string;
  reason?: string;
  requestId?: string;
  context?: Record<string, unknown>;
}
