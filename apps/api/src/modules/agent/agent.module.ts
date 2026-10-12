import { TautulliModule } from "../tautulli/tautulli.module";
import { AgentHistoryPipe } from "./agent-history.dto";
import { PlexModule } from "../plex/plex.module";
import { AgentSearchPipe, AgentRecentPipe } from "./agent-media.dto";
import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { AgentMessagePipe } from "./agent.dto";

@Module({ imports: [NotificationsModule, WhatsAppModule, PlexModule, TautulliModule], controllers: [AgentController], providers: [AgentService, AgentMessagePipe, AgentSearchPipe, AgentRecentPipe, AgentHistoryPipe] })
export class AgentModule {}
