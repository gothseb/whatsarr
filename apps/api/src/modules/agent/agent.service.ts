import { TautulliService } from "../tautulli/tautulli.service";
import { AgentHistoryQuery } from "../tautulli/tautulli.types";
import { PlexService } from "../plex/plex.service";
import { AgentMediaQuery, AgentRecentQuery } from "./agent-media.types";
import { Injectable } from "@nestjs/common";
import { NotificationsService } from "../notifications/notifications.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { AgentError, AgentMessage } from "./agent.types";

@Injectable()
export class AgentService {
  constructor(private readonly notifications: NotificationsService, private readonly whatsapp: WhatsAppService, private readonly plex: PlexService, private readonly tautulli: TautulliService) {}

  async submit(message: AgentMessage, requestId: string) {
    const result = await this.notifications.createAgentJob(message, requestId, async () => {
      const group = await this.whatsapp.getServerGroup();
      if (!group) throw new AgentError(409, "WHATSAPP_GROUP_NOT_SELECTED", "Selectionnez le groupe serveur WhatsApp.");
      return group.groupId;
    });
    return { jobId: result.row.id, messageId: message.messageId, status: result.row.status, deduplicated: !result.created, requestId };
  }

  search(query: AgentMediaQuery) { return this.plex.searchMedia(query); }

  recent(query: AgentRecentQuery) { return this.plex.recentMedia(query); }

  history(query: AgentHistoryQuery) { return this.tautulli.history(query); }

  status(jobId: string) { return this.notifications.getAgentStatus(jobId); }
}
