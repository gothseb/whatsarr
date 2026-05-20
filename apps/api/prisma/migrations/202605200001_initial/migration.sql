CREATE TABLE "admin_credentials" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'admin',
  "password_hash" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);

CREATE TABLE "service_settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "service_key" TEXT NOT NULL,
  "base_url" TEXT,
  "api_key_encrypted" TEXT,
  "username_encrypted" TEXT,
  "password_encrypted" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "service_settings_service_key_key" ON "service_settings"("service_key");
