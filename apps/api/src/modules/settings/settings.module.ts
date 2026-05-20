import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConnectionTestService } from "./connection-test.service";
import { EncryptionService } from "./encryption.service";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService, EncryptionService, ConnectionTestService],
  exports: [SettingsService]
})
export class SettingsModule {}
