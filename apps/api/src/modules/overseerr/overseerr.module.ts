import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { OverseerrService } from "./overseerr.service";

@Module({
  imports: [SettingsModule],
  providers: [OverseerrService],
  exports: [OverseerrService]
})
export class OverseerrModule {}
