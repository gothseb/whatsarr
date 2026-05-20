import { Observable } from "rxjs";

export const WHATSAPP_ADAPTER = Symbol("WHATSAPP_ADAPTER");

export type WhatsAppConnectionState =
  | "disconnected"
  | "initializing"
  | "qr"
  | "restoring"
  | "connected"
  | "failed";

export interface WhatsAppAdapterStatus {
  state: WhatsAppConnectionState;
  message: string;
  qrCode?: string;
  lastChangedAt: Date;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
  participantCount: number;
}

export interface WhatsAppGroupMember {
  whatsappId: string;
  displayName: string;
}

export interface WhatsAppAdapter {
  readonly status$: Observable<WhatsAppAdapterStatus>;
  getStatus(): WhatsAppAdapterStatus;
  hasLocalSession(): boolean;
  initialize(): Promise<WhatsAppAdapterStatus>;
  replaceSession(): Promise<WhatsAppAdapterStatus>;
  listGroups(): Promise<WhatsAppGroup[]>;
  listGroupMembers(groupId: string): Promise<WhatsAppGroupMember[]>;
  sendMessage(targetId: string, body: string, mediaUrl?: string | null): Promise<void>;
  disconnect(): Promise<void>;
}

export interface PublicWhatsAppStatus {
  state: WhatsAppConnectionState;
  message: string;
  qrCodeDataUrl: string | null;
  hasLocalSession: boolean;
  selectedGroup: PublicServerGroup | null;
  lastChangedAt: string;
}

export interface PublicServerGroup {
  groupId: string;
  name: string;
  updatedAt: string;
}

export interface PublicWhatsAppMember {
  whatsappId: string;
  displayName: string;
  mappingStatus: "lie" | "non_lie";
  isInServerGroup: boolean;
  lastSyncedAt: string;
}
