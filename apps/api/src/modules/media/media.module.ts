import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { MappingModule } from "../mapping/mapping.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SettingsModule } from "../settings/settings.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
  imports: [AuthModule, DatabaseModule, NotificationsModule, SettingsModule, MappingModule],
  controllers: [MediaController],
  providers: [MediaService]
})
export class MediaModule {}
