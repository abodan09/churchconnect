-- Private R2 receipts: store the bare object KEY (never a URL) so reads must go
-- through the role-gated presign endpoint. Additive + idempotent.
--   npx prisma db execute --file prisma/sql/2026-07-25_expenditure_receipt_key.sql --schema prisma/schema.prisma
-- Then: npx prisma generate   (else create/update {receipt_key} throws "Unknown arg")

ALTER TABLE "Expenditure" ADD COLUMN IF NOT EXISTS "receipt_key" TEXT;
