-- Server-assigned arrival clock for delta sync.
--
-- Every synced table carries a `serverUpdatedAt` column. This trigger stamps it
-- to the DATABASE clock (now()) on every INSERT and UPDATE — regardless of the
-- writing path (the web app's Prisma writes AND the raw-SQL upserts in
-- api/sync.js). That gives the PULL a single, monotonic, server-owned ordering
-- key that a client can never backdate, so an offline device that pushes a row
-- carrying an old business `updatedAt` still gets a fresh serverUpdatedAt and is
-- therefore seen by every other device. Business `updatedAt` is left untouched
-- (it remains the last-write-wins conflict key).
--
-- Idempotent: safe to re-run. Apply with:
--   npx prisma db execute --file prisma/sql/sync_server_stamp.sql --schema prisma/schema.prisma

CREATE OR REPLACE FUNCTION set_server_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."serverUpdatedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'Member', 'MemberRelationship', 'Department', 'Event', 'Giving',
    'Expenditure', 'Attendance', 'Sermon', 'Property', 'SmallGroup',
    'SmallGroupMember', 'PastoralCare', 'Volunteer', 'Announcement'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_server_updated_at ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_server_updated_at BEFORE INSERT OR UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_server_updated_at()', t);
  END LOOP;
END;
$$;
