-- Additive migration (run with `prisma db execute`, NEVER `prisma db push`):
--   Giving.giver_type  — who gave: member | church | department | ministry.
--                        Backfilled to 'member' (all pre-existing rows are member giving).
--   Giving.source_id   — Department id when giver_type is department/ministry.
--   Department.category — department | ministry (ministries are managed on the
--                         Departments page and listed separately in the Giving form).
-- Columns are NULLABLE so older desktop clients that push rows without them
-- never hit a NOT NULL violation; readers treat NULL as the legacy default.

ALTER TABLE "Giving" ADD COLUMN IF NOT EXISTS "giver_type" TEXT DEFAULT 'member';
ALTER TABLE "Giving" ADD COLUMN IF NOT EXISTS "source_id" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'department';
