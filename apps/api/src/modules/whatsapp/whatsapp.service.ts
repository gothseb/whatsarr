import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import QRCode from "qrcode";
import { Observable, ReplaySubject, Subscription } from "rxjs";
import { PrismaService } from "../database/prisma.service";
import {
  PublicServerGroup,
  PublicWhatsAppMember,
  PublicWhatsAppStatus,
  WhatsAppAdapter,
  WhatsAppAdapterStatus,
  WHATSAPP_ADAPTER
} from "./whatsapp.types";

interface SseMessage {
  data: PublicWhatsAppStatus;
}

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly events = new ReplaySubject<SseMessage>(1);
  private subscription?: Subscription;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_ADAPTER) private readonly adapter: WhatsAppAdapter
  ) {}

  async onModuleInit() {
    this.subscription = this.adapter.status$.subscribe((status) => {
      void this.publishStatus(status);
    });
    await this.publishStatus(this.adapter.getStatus());

    if (this.adapter.hasLocalSession()) {
      void this.adapter.initialize();
    }
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }

  stream(): Observable<SseMessage> {
    return this.events.asObservable();
  }

  async getStatus() {
    return this.toPublicStatus(this.adapter.getStatus());
  }

  async connect(replaceExistingSession = false) {
    const state = this.adapter.getStatus().state;
    const hasSession = this.adapter.hasLocalSession();

    if (!replaceExistingSession && (hasSession || state === "connected" || state === "qr")) {
      throw new ConflictException(
        "Une seule session WhatsApp est supportee en V1. Confirmez le remplacement pour continuer."
      );
    }

    const status = replaceExistingSession
      ? await this.adapter.replaceSession()
      : await this.adapter.initialize();

    await this.publishStatus(status);
    return this.toPublicStatus(status);
  }

  async listGroups() {
    this.assertConnected();
    return this.adapter.listGroups();
  }

  async refreshGroups() {
    return this.listGroups();
  }

  async getServerGroup() {
    return this.loadServerGroup();
  }

  async selectServerGroup(groupId: string, name: string, confirmReplace = false) {
    const current = await this.prisma.whatsAppServerGroup.findUnique({
      where: { id: "server" }
    });

    if (current && current.groupId !== groupId && !confirmReplace) {
      throw new ConflictException(
        "Un Groupe serveur est deja selectionne. Confirmez le remplacement pour continuer."
      );
    }

    const group = await this.prisma.whatsAppServerGroup.upsert({
      where: { id: "server" },
      create: {
        id: "server",
        groupId,
        name
      },
      update: {
        groupId,
        name
      }
    });

    if (current && current.groupId !== groupId) {
      this.logger.log(
        `Groupe serveur WhatsApp remplace: ${current.groupId} -> ${groupId}`
      );
    }

    await this.publishStatus(this.adapter.getStatus());
    return this.toPublicServerGroup(group);
  }

  async requireServerGroup() {
    const group = await this.prisma.whatsAppServerGroup.findUnique({
      where: { id: "server" }
    });

    if (!group) {
      throw new BadRequestException("WHATSAPP_GROUP_NOT_SELECTED");
    }

    return group;
  }

  async importServerGroupMembers() {
    const group = await this.requireServerGroup();
    this.assertConnected();

    const now = new Date();
    const members = await this.adapter.listGroupMembers(group.groupId);
    const activeIds = new Set(members.map((member) => member.whatsappId));

    await this.prisma.$transaction(async (tx) => {
      for (const member of members) {
        await tx.whatsAppContact.upsert({
          where: { whatsappId: member.whatsappId },
          create: {
            whatsappId: member.whatsappId,
            displayName: member.displayName,
            isInServerGroup: true,
            lastSyncedAt: now
          },
          update: {
            displayName: member.displayName,
            isInServerGroup: true,
            lastSyncedAt: now
          }
        });
      }

      await tx.whatsAppContact.updateMany({
        where: {
          whatsappId: { notIn: Array.from(activeIds) },
          isInServerGroup: true
        },
        data: {
          isInServerGroup: false,
          lastSyncedAt: now
        }
      });
    });

    return this.listMembers();
  }

  async listMembers(): Promise<PublicWhatsAppMember[]> {
    const rows = await this.prisma.whatsAppContact.findMany({
      include: { mappings: true },
      orderBy: [{ isInServerGroup: "desc" }, { displayName: "asc" }]
    });

    return rows.map((row) => ({
      whatsappId: row.whatsappId,
      displayName: row.displayName,
      mappingStatus: row.mappings.length > 0 ? "lie" : "non_lie",
      isInServerGroup: row.isInServerGroup,
      lastSyncedAt: row.lastSyncedAt.toISOString()
    }));
  }

  private assertConnected() {
    if (this.adapter.getStatus().state !== "connected") {
      throw new BadRequestException("Une connexion WhatsApp active est requise.");
    }
  }

  private async publishStatus(status: WhatsAppAdapterStatus) {
    this.events.next({ data: await this.toPublicStatus(status) });
  }

  private async toPublicStatus(
    status: WhatsAppAdapterStatus
  ): Promise<PublicWhatsAppStatus> {
    return {
      state: status.state,
      message: status.message,
      qrCodeDataUrl: status.qrCode ? await QRCode.toDataURL(status.qrCode) : null,
      hasLocalSession: this.adapter.hasLocalSession(),
      selectedGroup: await this.loadServerGroup(),
      lastChangedAt: status.lastChangedAt.toISOString()
    };
  }

  private async loadServerGroup(): Promise<PublicServerGroup | null> {
    const group = await this.prisma.whatsAppServerGroup.findUnique({
      where: { id: "server" }
    });

    return group ? this.toPublicServerGroup(group) : null;
  }

  private toPublicServerGroup(row: {
    groupId: string;
    name: string;
    updatedAt: Date;
  }): PublicServerGroup {
    return {
      groupId: row.groupId,
      name: row.name,
      updatedAt: row.updatedAt.toISOString()
    };
  }
}
