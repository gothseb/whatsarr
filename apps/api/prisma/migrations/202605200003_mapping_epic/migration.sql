CREATE TABLE "plex_users" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "plex_user_id" TEXT NOT NULL,
  "username" TEXT,
  "display_name" TEXT NOT NULL,
  "last_synced_at" DATETIME NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "plex_users_plex_user_id_key"
ON "plex_users"("plex_user_id");

CREATE TABLE "user_contact_mappings" (
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
);

CREATE UNIQUE INDEX "user_contact_mappings_plex_user_record_id_whatsapp_contact_id_key"
ON "user_contact_mappings"("plex_user_record_id", "whatsapp_contact_id");
