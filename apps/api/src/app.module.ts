import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "node:path";
import { AuthModule } from "./modules/auth/auth.module";
import { DatabaseModule } from "./modules/database/database.module";
import { HealthModule } from "./modules/health/health.module";
import { MappingModule } from "./modules/mapping/mapping.module";
import { MediaModule } from "./modules/media/media.module";
import { MonthlyRecapModule } from "./modules/monthly-recap/monthly-recap.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { TemplatesModule } from "./modules/templates/templates.module";
import { WhatsAppModule } from "./modules/whatsapp/whatsapp.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath:
        process.env.WEB_DIST_DIR ?? join(process.cwd(), "..", "web", "dist"),
      exclude: ["/api/{*path}"]
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    SettingsModule,
    WhatsAppModule,
    MappingModule,
    TemplatesModule,
    NotificationsModule,
    MediaModule,
    MonthlyRecapModule
  ]
})
export class AppModule {}
