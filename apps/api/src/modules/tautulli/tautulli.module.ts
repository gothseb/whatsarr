import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { TautulliService } from "./tautulli.service";
@Module({imports:[SettingsModule],providers:[TautulliService],exports:[TautulliService]})
export class TautulliModule {}
