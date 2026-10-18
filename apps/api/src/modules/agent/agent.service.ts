import { TautulliService } from "../tautulli/tautulli.service";
import { AgentHistoryQuery } from "../tautulli/tautulli.types";
import { PlexService } from "../plex/plex.service";
import { AgentCatalogueQuery, AgentMediaQuery, AgentRecentQuery } from "./agent-media.types";
import { PrismaService } from "../database/prisma.service";
import { Injectable } from "@nestjs/common";
import { NotificationsService } from "../notifications/notifications.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { AgentError, AgentMessage } from "./agent.types";

@Injectable()
export class AgentService {
  constructor(private readonly notifications: NotificationsService, private readonly whatsapp: WhatsAppService, private readonly plex: PlexService, private readonly tautulli: TautulliService, private readonly prisma: PrismaService) {}

  async submit(message: AgentMessage, requestId: string) {
    const result = await this.notifications.createAgentJob(message, requestId, async () => {
      const group = await this.whatsapp.getServerGroup();
      if (!group) throw new AgentError(409, "WHATSAPP_GROUP_NOT_SELECTED", "Selectionnez le groupe serveur WhatsApp.");
      return group.groupId;
    });
    return { jobId: result.row.id, messageId: message.messageId, status: result.row.status, deduplicated: !result.created, requestId };
  }

  async search(query: AgentMediaQuery) { return this.plex.searchMedia(query, await this.recapLibraries(query.libraryKey)); }

  async recent(query: AgentRecentQuery) { return this.plex.recentMedia(query, await this.recapLibraries(query.libraryKey)); }

  async catalogue(query: AgentCatalogueQuery) { return this.plex.listMedia(query, await this.recapLibraries(query.libraryKey)); }

  async recapLibraries(libraryKey?: string) {
    const libraries = await this.prisma.monthlyRecapLibrary.findMany({ where: { included: true }, select: { plexKey: true } });
    const keys = new Set(libraries.map((library) => library.plexKey));
    if (libraryKey !== undefined && !keys.has(libraryKey)) throw new AgentError(404, "PLEX_LIBRARY_NOT_FOUND", "Bibliothèque Plex introuvable ou non activée pour le récapitulatif.");
    return keys;
  }

  history(query: AgentHistoryQuery) { return this.tautulli.history(query); }

  status(jobId: string) { return this.notifications.getAgentStatus(jobId); }
}
