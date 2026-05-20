import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { WhatsAppWebJsAdapter } from "./adapters/whatsapp-web-js.adapter";
import { WhatsAppController } from "./whatsapp.controller";
import { WhatsAppService } from "./whatsapp.service";
import { WHATSAPP_ADAPTER } from "./whatsapp.types";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppWebJsAdapter,
    {
      provide: WHATSAPP_ADAPTER,
      useExisting: WhatsAppWebJsAdapter
    }
  ],
  exports: [WhatsAppService, WHATSAPP_ADAPTER]
})
export class WhatsAppModule {}
