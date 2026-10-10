import { sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/neon-serverless';
let initialization: Promise<void> | undefined;
// Authenticated, additive bootstrap preserves existing owners and records.
export function ensureSyncSchema(database: ReturnType<typeof drizzle>) {
  return (initialization ??= database
    .transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('cinevault-schema-v2'))`);
      await tx.execute(sql`CREATE SEQUENCE IF NOT EXISTS cinevault_sync_sequence`);
      await tx.execute(sql`CREATE TABLE IF NOT EXISTS sync_records (
      owner_id text NOT NULL, key text NOT NULL, kind text NOT NULL,
      record_id text NOT NULL, payload jsonb, deleted boolean NOT NULL DEFAULT false,
      revision integer NOT NULL, sequence bigint NOT NULL DEFAULT nextval('cinevault_sync_sequence'),
      mutation_id text NOT NULL, PRIMARY KEY (owner_id, key),
      CHECK (kind IN ('media','entries','lists','items','preferences'))
    )`);
      await tx.execute(sql`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'sync_records'::regclass
        AND conname = 'sync_records_kind_check'
        AND position('preferences' in pg_get_constraintdef(oid)) = 0) THEN
        ALTER TABLE sync_records DROP CONSTRAINT sync_records_kind_check;
        ALTER TABLE sync_records ADD CONSTRAINT sync_records_kind_check
          CHECK (kind IN ('media','entries','lists','items','preferences'));
      END IF;
    END $$`);
      await tx.execute(
        sql`CREATE INDEX IF NOT EXISTS sync_owner_sequence ON sync_records(owner_id, sequence)`,
      );
    })
    .catch((error) => {
      initialization = undefined;
      throw error;
    }));
}
