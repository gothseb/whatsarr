CREATE TABLE "message_templates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "template_type" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "message_templates_template_type_key" ON "message_templates"("template_type");

CREATE TABLE "notification_jobs" (
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
);

CREATE UNIQUE INDEX "notification_jobs_dedupe_key_key" ON "notification_jobs"("dedupe_key");
CREATE INDEX "notification_jobs_status_scheduled_at_idx" ON "notification_jobs"("status", "scheduled_at");

CREATE TABLE "operational_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "level" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "reason" TEXT,
  "message" TEXT NOT NULL,
  "request_id" TEXT,
  "context_json" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "operational_logs_created_at_idx" ON "operational_logs"("created_at");

CREATE TABLE "media_availability_events" (
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
);

CREATE UNIQUE INDEX "media_availability_events_dedupe_key_key" ON "media_availability_events"("dedupe_key");
CREATE INDEX "media_availability_events_source_event_type_idx" ON "media_availability_events"("source", "event_type");

CREATE TABLE "app_settings" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updated_at" DATETIME NOT NULL
);
