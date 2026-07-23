-- Member address history (JSON of past addresses) + family relationships.

ALTER TABLE "Member" ADD COLUMN "address_history" TEXT;

CREATE TABLE "MemberRelationship" (
  "id"                TEXT NOT NULL,
  "church_id"         TEXT NOT NULL,
  "member_id"         TEXT NOT NULL,
  "relationship_type" TEXT NOT NULL,
  "related_member_id" TEXT,
  "related_name"      TEXT,
  "related_phone"     TEXT,
  "related_email"     TEXT,
  "related_notes"     TEXT,
  "created_by_id"     TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberRelationship_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberRelationship_member_id_idx" ON "MemberRelationship"("member_id");
CREATE INDEX "MemberRelationship_related_member_id_idx" ON "MemberRelationship"("related_member_id");
CREATE INDEX "MemberRelationship_church_id_idx" ON "MemberRelationship"("church_id");

-- Match the church-scoping FK convention used by every other tenant table.
ALTER TABLE "MemberRelationship" ADD CONSTRAINT "MemberRelationship_church_id_fkey"
  FOREIGN KEY ("church_id") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
