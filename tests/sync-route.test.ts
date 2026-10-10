import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { fixture } from './fixtures';

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  end: vi.fn(),
  connect: vi.fn(),
  predicates: [] as SQL[],
  written: [] as { ownerId: string }[],
}));
vi.mock('next-auth/jwt', () => ({ getToken: mocks.getToken }));
vi.mock('@neondatabase/serverless', () => ({
  Pool: class {
    constructor() {
      mocks.connect();
    }
    end = mocks.end;
  },
}));
vi.mock('drizzle-orm/neon-serverless', () => ({
  drizzle: () => ({
    transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        execute: vi.fn(),
        select: () => ({
          from: () => ({
            where: (predicate: SQL) => {
              mocks.predicates.push(predicate);
              return Object.assign(Promise.resolve([]), {
                orderBy: () => ({ limit: async () => [] }),
              });
            },
          }),
        }),
        insert: () => ({
          values: (value: { ownerId: string }) => {
            mocks.written.push(value);
            return { onConflictDoUpdate: async () => undefined };
          },
        }),
      }),
  }),
}));
import { POST } from '@/app/api/sync/route';
const request = (
  expectedOwner = 'google:alice',
  origin = 'https://cinevault.test',
  changes: unknown[] = [],
) =>
  new NextRequest('https://cinevault.test/api/sync', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedOwner, cursor: 0, changes }),
  });
beforeEach(() => {
  mocks.getToken.mockReset();
  mocks.connect.mockClear();
  mocks.end.mockClear();
  mocks.predicates.length = 0;
  mocks.written.length = 0;
  vi.stubEnv('DATABASE_URL', 'postgresql://test.invalid/cinevault');
  vi.stubEnv('NEXTAUTH_SECRET', 'test-only-secret');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-secret');
});
afterEach(() => vi.unstubAllEnvs());

describe('server sync authorization', () => {
  it('blocks unauthenticated database access', async () => {
    mocks.getToken.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it('blocks old GitHub sessions', async () => {
    mocks.getToken.mockResolvedValue({ sub: 'github:alice' });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it('blocks cross-origin writes', async () => {
    mocks.getToken.mockResolvedValue({ sub: 'google:alice' });
    expect((await POST(request('google:alice', 'https://evil.test'))).status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it('rejects a client owner that differs from the verified account', async () => {
    mocks.getToken.mockResolvedValue({ sub: 'google:bob' });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it.each(['alice', 'bob'])('scopes reads and writes to the verified %s account', async (id) => {
    const owner = `google:${id}`;
    mocks.getToken.mockResolvedValue({ sub: owner });
    const change = {
      key: 'media/movie:911',
      kind: 'media',
      recordId: 'movie:911',
      payload: fixture(),
      deleted: false,
      baseRevision: 0,
      mutationId: crypto.randomUUID(),
    };
    const result = await POST(request(owner, 'https://cinevault.test', [change]));
    expect(result.status).toBe(200);
    expect(mocks.written).toMatchObject([{ ownerId: owner }]);
    const dialect = new PgDialect();
    expect(mocks.predicates).toHaveLength(2);
    for (const predicate of mocks.predicates) {
      const query = dialect.sqlToQuery(predicate);
      expect(query.sql).toContain('"sync_records"."owner_id"');
      expect(query.params[0]).toBe(owner);
    }
    expect(mocks.end).toHaveBeenCalledOnce();
  });
});
