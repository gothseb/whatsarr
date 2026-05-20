export const APP_NAME = "Whatsarr";

export const MEDIA_SERVICES = [
  "plex",
  "tautulli",
  "overseerr",
  "radarr",
  "sonarr",
  "tmdb"
] as const;

export type MediaServiceKey = (typeof MEDIA_SERVICES)[number];

export type ConnectionStatus =
  | "connected"
  | "authentication_error"
  | "unreachable"
  | "not_configured";

export interface PublicServiceSettings {
  serviceKey: MediaServiceKey;
  baseUrl: string | null;
  hasApiKey: boolean;
  hasUsername: boolean;
  hasPassword: boolean;
  updatedAt: string | null;
}

export type WhatsAppConnectionState =
  | "disconnected"
  | "initializing"
  | "qr"
  | "restoring"
  | "connected"
  | "failed";

export interface PublicServerGroup {
  groupId: string;
  name: string;
  updatedAt: string;
}

export interface PublicWhatsAppStatus {
  state: WhatsAppConnectionState;
  message: string;
  qrCodeDataUrl: string | null;
  hasLocalSession: boolean;
  selectedGroup: PublicServerGroup | null;
  lastChangedAt: string;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
  participantCount: number;
}

export interface PublicWhatsAppMember {
  whatsappId: string;
  displayName: string;
  mappingStatus: "lie" | "non_lie";
  isInServerGroup: boolean;
  lastSyncedAt: string;
}

export interface PublicMappingContact {
  id: string;
  whatsappId: string;
  displayName: string;
  isInServerGroup: boolean;
}

export interface PublicMappedPlexUser {
  id: string;
  plexUserId: string;
  displayName: string;
}

export interface PublicPlexUser {
  plexUserId: string;
  username: string | null;
  displayName: string;
  mappingStatus: "lie" | "non_notifiable";
  linkedContacts: PublicMappingContact[];
  lastSyncedAt: string;
}

export interface PublicMappableWhatsAppContact {
  whatsappId: string;
  displayName: string;
  mappingStatus: "lie" | "non_lie";
  isInServerGroup: boolean;
  linkedPlexUsers: PublicMappedPlexUser[];
  lastSyncedAt: string;
}

export interface PublicUserContactMapping {
  id: string;
  plexUserId: string;
  plexDisplayName: string;
  whatsappId: string;
  whatsappDisplayName: string;
  createdAt: string;
}

export interface PublicMappingState {
  plexUsers: PublicPlexUser[];
  whatsappContacts: PublicMappableWhatsAppContact[];
  nonNotifiableCount: number;
}

export type MessageTemplateType =
  | "announcement"
  | "request_available"
  | "new_episode"
  | "monthly_recap";

export interface PublicMessageTemplate {
  type: MessageTemplateType;
  label: string;
  body: string;
  variables: string[];
  updatedAt: string | null;
}

export interface PublicNotificationJob {
  id: string;
  type: string;
  targetType: string;
  targetId: string;
  payload: unknown;
  status: string;
  attempts: number;
  dedupeKey: string;
  scheduledAt: string;
  sentAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  requestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicOperationalLog {
  id: string;
  level: string;
  event: string;
  reason: string | null;
  message: string;
  requestId: string | null;
  context: unknown;
  createdAt: string;
}

export interface PublicMonthlyRecapLibrary {
  plexKey: string;
  title: string;
  type: string | null;
  included: boolean;
  lastSyncedAt: string;
}

export interface PublicMonthlyRecapRankingEntry {
  key: string;
  title: string;
  mediaType: "movie" | "series";
  distinctUserCount: number;
  rawPlayCount: number;
}

export interface PublicMonthlyRecapStatus {
  id: string;
  month: string;
  status: "queued" | "sent" | "failed" | "ignored" | "empty";
  reason: string | null;
  source: string;
  ranking: PublicMonthlyRecapRankingEntry[];
  jobId: string | null;
  requestId: string | null;
  calculatedAt: string;
  sentAt: string | null;
  updatedAt: string;
}

export interface PublicMonthlyRecapSchedule {
  dayOfMonth: number;
  time: string;
}

export interface PublicAppLiveStatus {
  generatedAt: string;
  whatsApp: PublicWhatsAppStatus;
  integrations: Array<{
    serviceKey: MediaServiceKey;
    label: string;
    configured: boolean;
    updatedAt: string | null;
  }>;
  jobs: PublicNotificationJob[];
  monthlyRecap: PublicMonthlyRecapStatus | null;
}
