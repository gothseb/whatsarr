CREATE TABLE "monthly_recap_libraries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plex_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "monthly_recap_libraries_plex_key_key" ON "monthly_recap_libraries"("plex_key");

CREATE TABLE "monthly_recap_runs" (
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
);

CREATE UNIQUE INDEX "monthly_recap_runs_month_key" ON "monthly_recap_runs"("month");
CREATE INDEX "monthly_recap_runs_calculated_at_idx" ON "monthly_recap_runs"("calculated_at");
