import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PlexModule } from "../plex/plex.module";
import { SettingsModule } from "../settings/settings.module";
import { WhatsAppModule } from "../whatsapp/whatsapp.module";
import { MonthlyRecapController } from "./monthly-recap.controller";
import { MonthlyRecapService } from "./monthly-recap.service";
import { StatusController } from "./status.controller";
import { StatusService } from "./status.service";

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    SettingsModule,
    PlexModule,
    NotificationsModule,
    WhatsAppModule
  ],
  controllers: [MonthlyRecapController, StatusController],
  providers: [MonthlyRecapService, StatusService],
  exports: [MonthlyRecapService, StatusService]
})
export class MonthlyRecapModule {}
