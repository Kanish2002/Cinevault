import type { NextRequest } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { and, eq, gt, asc, sql } from 'drizzle-orm';
import { syncRecords } from '@/lib/sync/schema';
import { cloudConfigured, getAuth } from '@/lib/sync/auth';
import { accountOwner, syncIdentityMatches } from '@/lib/sync/identity';
import { ensureSyncSchema } from '@/lib/sync/migrate';
import { syncRequest, validateChange } from '@/lib/sync/protocol';
import { guard, errorResponse } from '@/lib/api/route';
export async function POST(req: NextRequest) {
  if (!cloudConfigured())
    return Response.json(
      { error: 'Cloud sync is not configured. Local mode remains available.' },
      { status: 503 },
    );
  let pool: Pool | undefined;
  try {
    guard(req);
    if (req.headers.get('origin') !== new URL(req.url).origin)
      return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
    const { data: session, error } = await getAuth().getSession();
    if (error)
      return Response.json(
        { error: 'Account service is unavailable. Your local changes are safe.' },
        { status: 503 },
      );
    const owner = accountOwner(session?.user?.id);
    if (!owner)
      return Response.json({ error: 'Sign in to synchronize your collection.' }, { status: 401 });
    const raw = await req.text();
    if (raw.length > 2000000)
      return Response.json({ error: 'Sync batch too large.' }, { status: 413 });
    const body = syncRequest.parse(JSON.parse(raw));
    if (!syncIdentityMatches(owner, body.expectedOwner))
      return Response.json(
        { error: 'Your signed-in account changed. Reload before synchronizing.' },
        { status: 409 },
      );
    const changes = body.changes.map(validateChange);
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const database = drizzle(pool);
    await ensureSyncSchema(database);
    const result = await database.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${owner}))`);
      const accepted: { key: string; mutationId: string; revision: number }[] = [],
        conflicts: string[] = [];
      for (const c of changes) {
        const where = and(eq(syncRecords.ownerId, owner), eq(syncRecords.key, c.key));
        const [current] = await tx.select().from(syncRecords).where(where);
        if (current?.mutationId === c.mutationId) {
          accepted.push({
            key: c.key,
            mutationId: c.mutationId,
            revision: current.revision,
          });
          continue;
        }
        if ((current?.revision ?? 0) !== c.baseRevision) {
          conflicts.push(c.key);
          continue;
        }
        const revision = (current?.revision ?? 0) + 1;
        const value = {
          ownerId: owner,
          key: c.key,
          kind: c.kind,
          recordId: c.recordId,
          payload: c.payload ?? null,
          deleted: c.deleted,
          revision,
          sequence: sql<number>`nextval('cinevault_sync_sequence')`,
          mutationId: c.mutationId,
        };
        await tx
          .insert(syncRecords)
          .values(value)
          .onConflictDoUpdate({
            target: [syncRecords.ownerId, syncRecords.key],
            set: value,
          });
        accepted.push({ key: c.key, mutationId: c.mutationId, revision });
      }
      const records = await tx
        .select()
        .from(syncRecords)
        .where(and(eq(syncRecords.ownerId, owner), gt(syncRecords.sequence, body.cursor)))
        .orderBy(asc(syncRecords.sequence))
        .limit(1000);
      return {
        accepted,
        conflicts,
        records: records.map((record) => ({
          key: record.key,
          kind: record.kind,
          recordId: record.recordId,
          payload: record.payload,
          deleted: record.deleted,
          revision: record.revision,
          sequence: record.sequence,
        })),
        cursor: records.at(-1)?.sequence ?? body.cursor,
        hasMore: records.length === 1000,
      };
    });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  } finally {
    await pool?.end();
  }
}
