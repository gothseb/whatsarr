import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { OverseerrModule } from "../overseerr/overseerr.module";
import { PlexModule } from "../plex/plex.module";
import { MappingController } from "./mapping.controller";
import { MappingService } from "./mapping.service";

@Module({
  imports: [AuthModule, DatabaseModule, OverseerrModule, PlexModule],
  controllers: [MappingController],
  providers: [MappingService],
  exports: [MappingService]
})
export class MappingModule {}
