import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ configured: true, get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/sync/auth', () => ({
  cloudConfigured: () => mocks.configured,
  getAuth: () => ({ handler: () => ({ GET: mocks.get, POST: mocks.post }) }),
}));
import { GET, POST } from '@/app/api/auth/[...path]/route';
const context = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });
const request = (path: string, body: unknown, origin = 'https://cinevault.test') =>
  new Request(`https://cinevault.test/api/auth/${path}`, {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  mocks.configured = true;
  mocks.get.mockReset();
  mocks.post.mockReset();
});
describe('managed account proxy', () => {
  it('keeps local mode usable without auth configuration', async () => {
    mocks.configured = false;
    expect(
      await (
        await GET(
          new Request('https://cinevault.test/api/auth/get-session'),
          context('get-session'),
        )
      ).json(),
    ).toBeNull();
    expect((await POST(request('sign-in/email', {}), context('sign-in/email'))).status).toBe(503);
  });
  it('rejects cross-origin sign-in and unsupported provider/admin operations', async () => {
    expect(
      (await POST(request('sign-in/email', {}, 'https://evil.test'), context('sign-in/email')))
        .status,
    ).toBe(403);
    expect((await POST(request('admin/list-users', {}), context('admin/list-users'))).status).toBe(
      404,
    );
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('requires a strong app password and normalizes email before forwarding', async () => {
    expect(
      (await POST(request('sign-up/email', { password: 'short' }), context('sign-up/email')))
        .status,
    ).toBe(400);
    mocks.post.mockImplementation(async (req: Request) => {
      expect(await req.json()).toEqual({
        email: 'user@gmail.com',
        password: 'a-long-app-password',
        name: 'User',
      });
      return Response.json({ user: { id: 'provider-id' } });
    });
    const body = { email: ' User@Gmail.com ', password: 'a-long-app-password', name: 'User' };
    expect((await POST(request('sign-up/email', body), context('sign-up/email'))).status).toBe(200);
    expect(mocks.post).toHaveBeenCalledOnce();
  });
});
