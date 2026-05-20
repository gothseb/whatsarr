import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    ensureSqliteDirectory();
    await this.$connect();
    await this.ensureSchema();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async ensureSchema() {
    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "admin_credentials" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'admin',
        "password_hash" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "service_settings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "service_key" TEXT NOT NULL,
        "base_url" TEXT,
        "api_key_encrypted" TEXT,
        "username_encrypted" TEXT,
        "password_encrypted" TEXT,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "service_settings_service_key_key"
      ON "service_settings"("service_key")
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "whatsapp_server_groups" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'server',
        "group_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "whatsapp_contacts" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "whatsapp_id" TEXT NOT NULL,
        "display_name" TEXT NOT NULL,
        "is_in_server_group" BOOLEAN NOT NULL DEFAULT true,
        "last_synced_at" DATETIME NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_contacts_whatsapp_id_key"
      ON "whatsapp_contacts"("whatsapp_id")
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "plex_users" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "plex_user_id" TEXT NOT NULL,
        "username" TEXT,
        "display_name" TEXT NOT NULL,
        "last_synced_at" DATETIME NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "plex_users_plex_user_id_key"
      ON "plex_users"("plex_user_id")
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "user_contact_mappings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "plex_user_record_id" TEXT NOT NULL,
        "whatsapp_contact_id" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "user_contact_mappings_plex_user_record_id_fkey"
          FOREIGN KEY ("plex_user_record_id") REFERENCES "plex_users" ("id")
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "user_contact_mappings_whatsapp_contact_id_fkey"
          FOREIGN KEY ("whatsapp_contact_id") REFERENCES "whatsapp_contacts" ("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_contact_mappings_plex_user_record_id_whatsapp_contact_id_key"
      ON "user_contact_mappings"("plex_user_record_id", "whatsapp_contact_id")
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "message_templates" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "template_type" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_template_type_key"
      ON "message_templates"("template_type")
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "notification_jobs" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "type" TEXT NOT NULL,
        "target_type" TEXT NOT NULL,
        "target_id" TEXT NOT NULL,
        "payload_json" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "dedupe_key" TEXT NOT NULL,
        "scheduled_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "sent_at" DATETIME,
        "failed_at" DATETIME,
        "last_error" TEXT,
        "request_id" TEXT,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "notification_jobs_dedupe_key_key"
      ON "notification_jobs"("dedupe_key")
    `);

    await this.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "notification_jobs_status_scheduled_at_idx"
      ON "notification_jobs"("status", "scheduled_at")
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "operational_logs" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "level" TEXT NOT NULL,
        "event" TEXT NOT NULL,
        "reason" TEXT,
        "message" TEXT NOT NULL,
        "request_id" TEXT,
        "context_json" TEXT,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "operational_logs_created_at_idx"
      ON "operational_logs"("created_at")
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "media_availability_events" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "source" TEXT NOT NULL,
        "event_type" TEXT NOT NULL,
        "media_type" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "rating_key" TEXT,
        "tmdb_id" TEXT,
        "season_number" INTEGER,
        "episode_number" INTEGER,
        "release_date" DATETIME,
        "dedupe_key" TEXT NOT NULL,
        "payload_json" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "media_availability_events_dedupe_key_key"
      ON "media_availability_events"("dedupe_key")
    `);

    await this.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "media_availability_events_source_event_type_idx"
      ON "media_availability_events"("source", "event_type")
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "key" TEXT NOT NULL PRIMARY KEY,
        "value" TEXT NOT NULL,
        "updated_at" DATETIME NOT NULL
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "monthly_recap_libraries" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "plex_key" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "type" TEXT,
        "included" BOOLEAN NOT NULL DEFAULT true,
        "last_synced_at" DATETIME NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "monthly_recap_libraries_plex_key_key"
      ON "monthly_recap_libraries"("plex_key")
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "monthly_recap_runs" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "month" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "reason" TEXT,
        "source" TEXT NOT NULL DEFAULT 'tautulli',
        "ranking_json" TEXT NOT NULL DEFAULT '[]',
        "job_id" TEXT,
        "request_id" TEXT,
        "calculated_at" DATETIME NOT NULL,
        "sent_at" DATETIME,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "monthly_recap_runs_month_key"
      ON "monthly_recap_runs"("month")
    `);

    await this.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "monthly_recap_runs_calculated_at_idx"
      ON "monthly_recap_runs"("calculated_at")
    `);
  }
}

function ensureSqliteDirectory() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("file:")) {
    return;
  }

  const databasePath = databaseUrl.slice("file:".length);
  const directory = dirname(databasePath);
  if (directory && directory !== ".") {
    mkdirSync(directory, { recursive: true });
  }
}
