import { AgentArrController } from "./agent-arr.controller";
import { AgentArrService } from "./agent-arr.service";
import { AgentRequestsController } from "./agent-requests.controller";
import { AgentRequestsService } from "./agent-requests.service";
import { AgentCollectionsController } from "./agent-collections.controller";
import { AgentAvailabilityService } from "./agent-availability.service";
import { TautulliModule } from "../tautulli/tautulli.module";
import { AgentHistoryPipe } from "./agent-history.dto";
import { PlexModule } from "../plex/plex.module";
import { AgentCataloguePipe, AgentSearchPipe, AgentRecentPipe } from "./agent-media.dto";
import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { AgentMessagePipe } from "./agent.dto";
import { SettingsModule } from "../settings/settings.module";
import { AgentTmdbController } from "./agent-tmdb.controller";
import { AgentTmdbService } from "./agent-tmdb.service";

@Module({ imports: [NotificationsModule, WhatsAppModule, PlexModule, TautulliModule, SettingsModule], controllers: [AgentController, AgentTmdbController, AgentArrController, AgentRequestsController, AgentCollectionsController], providers: [AgentService, AgentMessagePipe, AgentCataloguePipe, AgentSearchPipe, AgentRecentPipe, AgentHistoryPipe, AgentTmdbService, AgentArrService, AgentRequestsService, AgentAvailabilityService] })
export class AgentModule {}
