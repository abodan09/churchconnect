-- Bring ChurchSettings into delta sync: add the server-assigned arrival clock
-- (same pattern as the 14 already-synced tables) + its trigger. Idempotent.
--   npx prisma db execute --file prisma/sql/2026-07-25_churchsettings_serverupdated.sql --schema prisma/schema.prisma

ALTER TABLE "ChurchSettings" ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "ChurchSettings_church_id_serverUpdatedAt_idx" ON "ChurchSettings"("church_id", "serverUpdatedAt");

-- set_server_updated_at() already exists (created with the original 14-table trigger).
DROP TRIGGER IF EXISTS trg_server_updated_at ON "ChurchSettings";
CREATE TRIGGER trg_server_updated_at BEFORE INSERT OR UPDATE ON "ChurchSettings"
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();
