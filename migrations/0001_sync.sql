CREATE SEQUENCE IF NOT EXISTS cinevault_sync_sequence;
CREATE TABLE IF NOT EXISTS sync_records (
 owner_id text NOT NULL, key text NOT NULL, kind text NOT NULL,
 record_id text NOT NULL, payload jsonb, deleted boolean NOT NULL DEFAULT false,
 revision integer NOT NULL, sequence bigint NOT NULL DEFAULT nextval('cinevault_sync_sequence'),
 mutation_id text NOT NULL,
 PRIMARY KEY (owner_id, key), CHECK (kind IN ('media','entries','lists','items'))
);
CREATE INDEX IF NOT EXISTS sync_owner_sequence ON sync_records(owner_id, sequence);
-- Scope is enforced by every authenticated server query. Never expose DATABASE_URL to clients.
