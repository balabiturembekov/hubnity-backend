-- CreateIndex: Ensure only ONE record per userId can have status RUNNING or PAUSED at any time.
-- Prevents race conditions when concurrent POST /time-entries or sync requests create duplicate active timers.
-- Note: For zero-downtime on large tables, run manually: CREATE UNIQUE INDEX CONCURRENTLY ...
CREATE UNIQUE INDEX "idx_time_entries_one_active_per_user"
ON "time_entries" ("userId")
WHERE "status" IN ('RUNNING', 'PAUSED');
