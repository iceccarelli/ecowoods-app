-- Supports the hourly /api/cron/rate-limit-cleanup sweep
-- (cleanupIdleRateLimitBuckets, lib/rate-limit-durable.ts), which deletes
-- buckets idle longer than its retention window. Without this index that
-- DELETE is a sequential scan over every distinct hashed key this
-- deployment has ever rate-limited.

-- CreateIndex
CREATE INDEX "RateLimitBucket_updatedAt_idx" ON "ecowoods"."RateLimitBucket"("updatedAt");
