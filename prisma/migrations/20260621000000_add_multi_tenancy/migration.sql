-- Multi-tenancy migration: add Church model and scope every table to a church_id.
-- Existing data is preserved by seeding a default Church from the current
-- ChurchSettings row (if one exists) before adding NOT NULL constraints.

-- ── 1. Create the Church (tenant root) table ──────────────────────────────────

CREATE TABLE "Church" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "plan"      TEXT NOT NULL DEFAULT 'trial',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Church_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Church_slug_key" ON "Church"("slug");

-- ── 2. Seed a default church from ChurchSettings (preserves existing data) ────

DO $$
DECLARE
  v_church_id TEXT := 'church_default_' || replace(gen_random_uuid()::text, '-', '');
  v_name      TEXT := 'My Church';
  v_slug      TEXT := 'my-church';
BEGIN
  -- Try to use existing ChurchSettings name
  SELECT COALESCE(church_name, 'My Church')
  INTO v_name
  FROM "ChurchSettings"
  LIMIT 1;

  -- Derive a URL-safe slug from the name
  v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN v_slug := 'my-church'; END IF;

  INSERT INTO "Church" ("id", "name", "slug", "plan", "is_active", "createdAt", "updatedAt")
  VALUES (v_church_id, v_name, v_slug, 'trial', true, NOW(), NOW());

  -- ── 3. Add church_id columns (nullable first so existing rows are preserved) ─

  ALTER TABLE "UserProfile"      ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "Member"           ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "Department"       ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "Event"            ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "Giving"           ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "Expenditure"      ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "Attendance"       ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "Sermon"           ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "Property"         ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "ChurchSettings"   ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "AccessRequest"    ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "SmallGroup"       ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "SmallGroupMember" ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "PastoralCare"     ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "Volunteer"        ADD COLUMN IF NOT EXISTS "church_id" TEXT;
  ALTER TABLE "Announcement"     ADD COLUMN IF NOT EXISTS "church_id" TEXT;

  -- ── 4. Backfill all existing rows with the default church ─────────────────

  UPDATE "UserProfile"      SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "Member"           SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "Department"       SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "Event"            SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "Giving"           SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "Expenditure"      SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "Attendance"       SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "Sermon"           SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "Property"         SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "ChurchSettings"   SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "AccessRequest"    SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "SmallGroup"       SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "SmallGroupMember" SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "PastoralCare"     SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "Volunteer"        SET "church_id" = v_church_id WHERE "church_id" IS NULL;
  UPDATE "Announcement"     SET "church_id" = v_church_id WHERE "church_id" IS NULL;

END $$;

-- ── 5. Make church_id NOT NULL and add FK constraints ─────────────────────────

ALTER TABLE "UserProfile"      ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "Member"           ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "Department"       ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "Event"            ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "Giving"           ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "Expenditure"      ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "Attendance"       ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "Sermon"           ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "Property"         ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "ChurchSettings"   ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "AccessRequest"    ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "SmallGroup"       ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "SmallGroupMember" ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "PastoralCare"     ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "Volunteer"        ALTER COLUMN "church_id" SET NOT NULL;
ALTER TABLE "Announcement"     ALTER COLUMN "church_id" SET NOT NULL;

-- Unique constraint: one settings row per church
CREATE UNIQUE INDEX IF NOT EXISTS "ChurchSettings_church_id_key" ON "ChurchSettings"("church_id");

-- FK constraints: all tables reference Church
ALTER TABLE "UserProfile"      ADD CONSTRAINT "UserProfile_church_id_fkey"      FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Member"           ADD CONSTRAINT "Member_church_id_fkey"           FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Department"       ADD CONSTRAINT "Department_church_id_fkey"       FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Event"            ADD CONSTRAINT "Event_church_id_fkey"            FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Giving"           ADD CONSTRAINT "Giving_church_id_fkey"           FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expenditure"      ADD CONSTRAINT "Expenditure_church_id_fkey"      FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance"       ADD CONSTRAINT "Attendance_church_id_fkey"       FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sermon"           ADD CONSTRAINT "Sermon_church_id_fkey"           FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Property"         ADD CONSTRAINT "Property_church_id_fkey"         FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChurchSettings"   ADD CONSTRAINT "ChurchSettings_church_id_fkey"   FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessRequest"    ADD CONSTRAINT "AccessRequest_church_id_fkey"    FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmallGroup"       ADD CONSTRAINT "SmallGroup_church_id_fkey"       FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmallGroupMember" ADD CONSTRAINT "SmallGroupMember_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PastoralCare"     ADD CONSTRAINT "PastoralCare_church_id_fkey"     FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Volunteer"        ADD CONSTRAINT "Volunteer_church_id_fkey"        FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Announcement"     ADD CONSTRAINT "Announcement_church_id_fkey"     FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 6. Indexes for common church-scoped lookups ───────────────────────────────

CREATE INDEX "Member_church_id_idx"           ON "Member"("church_id");
CREATE INDEX "Department_church_id_idx"       ON "Department"("church_id");
CREATE INDEX "Event_church_id_idx"            ON "Event"("church_id");
CREATE INDEX "Giving_church_id_idx"           ON "Giving"("church_id");
CREATE INDEX "Expenditure_church_id_idx"      ON "Expenditure"("church_id");
CREATE INDEX "Attendance_church_id_idx"       ON "Attendance"("church_id");
CREATE INDEX "Sermon_church_id_idx"           ON "Sermon"("church_id");
CREATE INDEX "Property_church_id_idx"         ON "Property"("church_id");
CREATE INDEX "AccessRequest_church_id_idx"    ON "AccessRequest"("church_id");
CREATE INDEX "SmallGroup_church_id_idx"       ON "SmallGroup"("church_id");
CREATE INDEX "SmallGroupMember_church_id_idx" ON "SmallGroupMember"("church_id");
CREATE INDEX "PastoralCare_church_id_idx"     ON "PastoralCare"("church_id");
CREATE INDEX "Volunteer_church_id_idx"        ON "Volunteer"("church_id");
CREATE INDEX "Announcement_church_id_idx"     ON "Announcement"("church_id");
CREATE INDEX "UserProfile_church_id_idx"      ON "UserProfile"("church_id");
