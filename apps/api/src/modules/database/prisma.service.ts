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
