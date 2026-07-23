-- Additive migration for delta sync: a server-assigned arrival clock on every
-- synced table + a keyset index for the PULL query.
--
-- Applied with `prisma db execute` (NOT `prisma db push`) on purpose: db push
-- would also drop a pre-existing MemberRelationship.church_id foreign key and an
-- updatedAt default that live in prod but not in schema.prisma — unrelated drift
-- this feature must not touch. This script only ADDs, and is idempotent.
--
--   npx prisma db execute --file prisma/sql/2026-07-24_sync_server_updated_at.sql --schema prisma/schema.prisma
--
-- Then apply the trigger that keeps the column fresh:
--   npx prisma db execute --file prisma/sql/sync_server_stamp.sql --schema prisma/schema.prisma

ALTER TABLE "Member"             ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MemberRelationship" ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Department"         ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Event"              ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Giving"             ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Expenditure"        ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Attendance"         ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Sermon"             ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Property"           ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SmallGroup"         ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SmallGroupMember"   ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PastoralCare"       ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Volunteer"          ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Announcement"       ADD COLUMN IF NOT EXISTS "serverUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Member_church_id_serverUpdatedAt_idx"             ON "Member"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "MemberRelationship_church_id_serverUpdatedAt_idx" ON "MemberRelationship"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "Department_church_id_serverUpdatedAt_idx"         ON "Department"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "Event_church_id_serverUpdatedAt_idx"              ON "Event"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "Giving_church_id_serverUpdatedAt_idx"             ON "Giving"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "Expenditure_church_id_serverUpdatedAt_idx"        ON "Expenditure"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "Attendance_church_id_serverUpdatedAt_idx"         ON "Attendance"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "Sermon_church_id_serverUpdatedAt_idx"             ON "Sermon"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "Property_church_id_serverUpdatedAt_idx"           ON "Property"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "SmallGroup_church_id_serverUpdatedAt_idx"         ON "SmallGroup"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "SmallGroupMember_church_id_serverUpdatedAt_idx"   ON "SmallGroupMember"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "PastoralCare_church_id_serverUpdatedAt_idx"       ON "PastoralCare"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "Volunteer_church_id_serverUpdatedAt_idx"          ON "Volunteer"("church_id", "serverUpdatedAt");
CREATE INDEX IF NOT EXISTS "Announcement_church_id_serverUpdatedAt_idx"       ON "Announcement"("church_id", "serverUpdatedAt");
