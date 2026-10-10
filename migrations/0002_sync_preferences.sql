ALTER TABLE sync_records DROP CONSTRAINT IF EXISTS sync_records_kind_check;
ALTER TABLE sync_records ADD CONSTRAINT sync_records_kind_check CHECK (kind IN ('media','entries','lists','items','preferences'));
