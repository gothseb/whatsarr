import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import type { Chat, GroupChat } from "whatsapp-web.js";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ReplaySubject } from "rxjs";
import type {
  WhatsAppAdapter,
  WhatsAppAdapterStatus,
  WhatsAppGroup,
  WhatsAppGroupMember
} from "../whatsapp.types";

const CLIENT_ID = "whatsarr";

@Injectable()
export class WhatsAppWebJsAdapter implements WhatsAppAdapter {
  private readonly logger = new Logger(WhatsAppWebJsAdapter.name);
  private readonly statusSubject = new ReplaySubject<WhatsAppAdapterStatus>(1);
  private client: Client | null = null;
  private status: WhatsAppAdapterStatus = {
    state: "disconnected",
    message: "Aucune session WhatsApp active.",
    lastChangedAt: new Date()
  };

  readonly status$ = this.statusSubject.asObservable();

  getStatus() {
    return this.status;
  }

  hasLocalSession() {
    return existsSync(this.sessionPath);
  }

  async initialize() {
    if (this.client) {
      return this.status;
    }

    this.setStatus({
      state: this.hasLocalSession() ? "restoring" : "initializing",
      message: this.hasLocalSession()
        ? "Restauration de la session WhatsApp en cours."
        : "Initialisation de la connexion WhatsApp."
    });

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: CLIENT_ID,
        dataPath: this.dataPath
      }),
      puppeteer: {
        executablePath: resolveBrowserExecutablePath(),
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu"
        ]
      }
    });

    this.client = client;
    this.bindEvents(client);

    try {
      await client.initialize();
    } catch (error) {
      this.client = null;
      this.setStatus({
        state: "failed",
        message: "WhatsApp n'a pas pu demarrer. Verifiez Chromium/Puppeteer."
      });
      this.logger.error(`Echec demarrage WhatsApp: ${safeErrorMessage(error)}`);
    }

    return this.status;
  }

  async replaceSession() {
    await this.disconnect();
    rmSync(this.dataPath, { recursive: true, force: true });
    return this.initialize();
  }

  async listGroups() {
    const client = this.requireConnectedClient();
    const chats = await client.getChats();

    return chats.filter(isGroupChat).map((chat) => ({
      id: serializeId(chat.id),
      name: chat.name || "Groupe sans nom",
      participantCount: chat.participants?.length ?? 0
    }));
  }

  async listGroupMembers(groupId: string) {
    const client = this.requireConnectedClient();
    const chat = await client.getChatById(groupId);

    if (!isGroupChat(chat)) {
      throw new BadRequestException("Le groupe WhatsApp selectionne est introuvable.");
    }

    const members = await Promise.all(
      chat.participants.map(async (participant) => {
        const whatsappId = serializeId(participant.id);
        const contact = await client.getContactById(whatsappId).catch(() => null);

        return {
          whatsappId,
          displayName:
            contact?.pushname ||
            contact?.name ||
            contact?.shortName ||
            contact?.number ||
            whatsappId
        };
      })
    );

    return members.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async sendMessage(targetId: string, body: string, mediaUrl?: string | null) {
    const client = this.requireConnectedClient();

    if (mediaUrl) {
      const media = await MessageMedia.fromUrl(mediaUrl);
      await client.sendMessage(targetId, media, { caption: body });
      return;
    }

    await client.sendMessage(targetId, body);
  }

  async disconnect() {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = null;
    await client.destroy().catch((error) => {
      this.logger.warn(`Echec arret WhatsApp: ${safeErrorMessage(error)}`);
    });
    this.setStatus({
      state: "disconnected",
      message: "Session WhatsApp arretee."
    });
  }

  private bindEvents(client: Client) {
    client.on("qr", (qrCode) => {
      this.setStatus({
        state: "qr",
        qrCode,
        message: "Scannez le QR code avec WhatsApp."
      });
    });

    client.on("ready", () => {
      this.setStatus({
        state: "connected",
        message: "Session WhatsApp connectee."
      });
    });

    client.on("authenticated", () => {
      this.setStatus({
        state: "restoring",
        message: "Session WhatsApp authentifiee, finalisation en cours."
      });
    });

    client.on("auth_failure", (message) => {
      this.setStatus({
        state: "failed",
        message: "Authentification WhatsApp refusee. Relancez une connexion QR."
      });
      this.logger.warn(`Echec authentification WhatsApp: ${sanitize(message)}`);
    });

    client.on("disconnected", (reason) => {
      this.client = null;
      this.setStatus({
        state: "disconnected",
        message: "Session WhatsApp deconnectee."
      });
      this.logger.warn(`Session WhatsApp deconnectee: ${sanitize(reason)}`);
    });
  }

  private requireConnectedClient() {
    if (!this.client || this.status.state !== "connected") {
      throw new BadRequestException("Une connexion WhatsApp active est requise.");
    }

    return this.client;
  }

  private setStatus(next: Omit<WhatsAppAdapterStatus, "lastChangedAt">) {
    this.status = {
      ...next,
      lastChangedAt: new Date()
    };
    this.statusSubject.next(this.status);
  }

  private get dataPath() {
    return join(process.env.DATA_DIR ?? join(process.cwd(), "data"), "whatsapp");
  }

  private get sessionPath() {
    return join(this.dataPath, `session-${CLIENT_ID}`);
  }
}

function isGroupChat(chat: Chat): chat is GroupChat {
  return Boolean(chat.isGroup);
}

function serializeId(value: { _serialized?: string } | string) {
  return typeof value === "string" ? value : value._serialized ?? String(value);
}

function safeErrorMessage(error: unknown) {
  return sanitize(error instanceof Error ? error.message : String(error));
}

function resolveBrowserExecutablePath() {
  const configuredPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROMIUM_PATH;

  if (configuredPath) {
    return configuredPath;
  }

  for (const candidate of getSystemBrowserCandidates()) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function getSystemBrowserCandidates() {
  if (process.platform !== "win32") {
    return [];
  }

  return [
    join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    join(
      process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)",
      "Google",
      "Chrome",
      "Application",
      "chrome.exe"
    ),
    join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    join(
      process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)",
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe"
    )
  ];
}

function sanitize(value: unknown) {
  return String(value)
    .replace(/([A-Za-z0-9+/=]{32,})/g, "[redacted]")
    .slice(0, 500);
}
