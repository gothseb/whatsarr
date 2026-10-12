import { AgentImageService } from "../agent/agent-image.service";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { TemplatesModule } from "../templates/templates.module";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [AuthModule, DatabaseModule, TemplatesModule, WhatsAppModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, AgentImageService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
