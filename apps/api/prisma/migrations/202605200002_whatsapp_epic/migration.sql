CREATE TABLE "whatsapp_server_groups" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'server',
  "group_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);

CREATE TABLE "whatsapp_contacts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "whatsapp_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "is_in_server_group" BOOLEAN NOT NULL DEFAULT true,
  "last_synced_at" DATETIME NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "whatsapp_contacts_whatsapp_id_key"
ON "whatsapp_contacts"("whatsapp_id");
