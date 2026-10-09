import {
  pgTable,
  text,
  integer,
  bigint,
  jsonb,
  boolean,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
export const syncRecords = pgTable(
  "sync_records",
  {
    ownerId: text("owner_id").notNull(),
    key: text("key").notNull(),
    kind: text("kind").notNull(),
    recordId: text("record_id").notNull(),
    payload: jsonb("payload"),
    deleted: boolean("deleted").notNull().default(false),
    revision: integer("revision").notNull(),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    mutationId: text("mutation_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ownerId, t.key] }),
    index("sync_owner_sequence").on(t.ownerId, t.sequence),
  ],
);
