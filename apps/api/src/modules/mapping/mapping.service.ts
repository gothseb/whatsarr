import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { OverseerrService } from "../overseerr/overseerr.service";
import { PlexService } from "../plex/plex.service";
import type { ImportedPlexUser } from "../plex/plex.service";

@Injectable()
export class MappingService {
  private readonly logger = new Logger(MappingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plex: PlexService,
    private readonly overseerr: OverseerrService
  ) {}

  async getState() {
    const [plexUsers, whatsappContacts] = await Promise.all([
      this.prisma.plexUser.findMany({
        include: {
          mappings: {
            include: { whatsappContact: true },
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: { displayName: "asc" }
      }),
      this.prisma.whatsAppContact.findMany({
        include: {
          mappings: {
            include: { plexUser: true },
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: [{ isInServerGroup: "desc" }, { displayName: "asc" }]
      })
    ]);

    const publicPlexUsers = plexUsers.map((user) => ({
      plexUserId: user.plexUserId,
      username: user.username,
      displayName: user.displayName,
      mappingStatus: user.mappings.length > 0 ? "lie" : "non_notifiable",
      linkedContacts: user.mappings.map((mapping) => ({
        id: mapping.id,
        whatsappId: mapping.whatsappContact.whatsappId,
        displayName: mapping.whatsappContact.displayName,
        isInServerGroup: mapping.whatsappContact.isInServerGroup
      })),
      lastSyncedAt: user.lastSyncedAt.toISOString()
    }));

    return {
      plexUsers: publicPlexUsers,
      whatsappContacts: whatsappContacts.map((contact) => ({
        whatsappId: contact.whatsappId,
        displayName: contact.displayName,
        mappingStatus: contact.mappings.length > 0 ? "lie" : "non_lie",
        isInServerGroup: contact.isInServerGroup,
        linkedPlexUsers: contact.mappings.map((mapping) => ({
          id: mapping.id,
          plexUserId: mapping.plexUser.plexUserId,
          displayName: mapping.plexUser.displayName
        })),
        lastSyncedAt: contact.lastSyncedAt.toISOString()
      })),
      nonNotifiableCount: publicPlexUsers.filter(
        (user) => user.mappingStatus === "non_notifiable"
      ).length
    };
  }

  async importPlexUsers() {
    const users = await this.fetchUsersFromBestSource();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const user of users) {
        await tx.plexUser.upsert({
          where: { plexUserId: user.plexUserId },
          create: {
            plexUserId: user.plexUserId,
            username: user.username,
            displayName: user.displayName,
            lastSyncedAt: now
          },
          update: {
            username: user.username,
            displayName: user.displayName,
            lastSyncedAt: now
          }
        });
      }
    });

    return this.getState();
  }

  async createMapping(plexUserId: string, whatsappId: string) {
    const [plexUser, whatsappContact] = await Promise.all([
      this.prisma.plexUser.findUnique({ where: { plexUserId } }),
      this.prisma.whatsAppContact.findUnique({ where: { whatsappId } })
    ]);

    if (!plexUser) {
      throw new NotFoundException("Utilisateur Plex introuvable.");
    }

    if (!whatsappContact) {
      throw new NotFoundException("Contact WhatsApp introuvable.");
    }

    const existing = await this.prisma.userContactMapping.findUnique({
      where: {
        plexUserRecordId_whatsappContactId: {
          plexUserRecordId: plexUser.id,
          whatsappContactId: whatsappContact.id
        }
      }
    });

    if (existing) {
      throw new ConflictException("Cette association Plex/WhatsApp existe deja.");
    }

    const row = await this.prisma.userContactMapping.create({
      data: {
        plexUserRecordId: plexUser.id,
        whatsappContactId: whatsappContact.id
      },
      include: { plexUser: true, whatsappContact: true }
    });

    return this.toPublicMapping(row);
  }

  async deleteMapping(id: string) {
    const existing = await this.prisma.userContactMapping.findUnique({
      where: { id },
      include: { plexUser: true, whatsappContact: true }
    });

    if (!existing) {
      throw new NotFoundException("Association Plex/WhatsApp introuvable.");
    }

    await this.prisma.userContactMapping.delete({ where: { id } });
    return this.toPublicMapping(existing);
  }

  async resolveRecipients(plexUserId: string) {
    if (!plexUserId.trim()) {
      throw new BadRequestException("Identifiant Plex requis.");
    }

    const lookup = plexUserId.trim();
    const user = await this.prisma.plexUser.findUnique({
      where: { plexUserId: lookup },
      include: {
        mappings: {
          include: { whatsappContact: true },
          orderBy: { createdAt: "asc" }
        }
      }
    }) ?? await this.findUserByAlias(lookup);

    if (!user || user.mappings.length === 0) {
      this.logger.warn(
        `Aucun contact WhatsApp lie pour l'utilisateur Plex ${plexUserId}.`
      );
      return [];
    }

    const recipients = [];
    for (const mapping of user.mappings) {
      if (!mapping.whatsappContact.isInServerGroup) {
        this.logger.warn(
          `Contact WhatsApp ${mapping.whatsappContact.whatsappId} ignore pour ${plexUserId}: hors Groupe serveur.`
        );
        continue;
      }

      recipients.push({
        whatsappId: mapping.whatsappContact.whatsappId,
        displayName: mapping.whatsappContact.displayName
      });
    }

    if (recipients.length === 0) {
      this.logger.warn(
        `Aucun contact WhatsApp actif pour l'utilisateur Plex ${plexUserId}.`
      );
    }

    return recipients;
  }

  private async fetchUsersFromBestSource(): Promise<ImportedPlexUser[]> {
    try {
      const users = await this.overseerr.fetchUsers();
      if (users.length > 0) {
        return users;
      }
      this.logger.warn("Overseerr n'a retourne aucun utilisateur, fallback Plex.");
    } catch (error) {
      this.logger.warn(
        `Import utilisateurs Overseerr indisponible, fallback Plex: ${safeErrorMessage(error)}`
      );
    }

    return this.plex.fetchUsers();
  }

  private async findUserByAlias(value: string) {
    const candidates = Array.from(new Set([value, `overseerr:${value}`]));
    return this.prisma.plexUser.findFirst({
      where: {
        OR: [
          { plexUserId: { in: candidates } },
          { username: value }
        ]
      },
      include: {
        mappings: {
          include: { whatsappContact: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });
  }

  private toPublicMapping(row: {
    id: string;
    createdAt: Date;
    plexUser: { plexUserId: string; displayName: string };
    whatsappContact: { whatsappId: string; displayName: string };
  }) {
    return {
      id: row.id,
      plexUserId: row.plexUser.plexUserId,
      plexDisplayName: row.plexUser.displayName,
      whatsappId: row.whatsappContact.whatsappId,
      whatsappDisplayName: row.whatsappContact.displayName,
      createdAt: row.createdAt.toISOString()
    };
  }
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
