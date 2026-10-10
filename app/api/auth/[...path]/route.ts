import { cloudConfigured, getAuth } from '@/lib/sync/auth';
type Context = { params: Promise<{ path: string[] }> };
const postPaths = new Set([
  'sign-up/email',
  'sign-in/email',
  'sign-out',
  'email-otp/request-password-reset',
  'email-otp/reset-password',
]);
export async function GET(req: Request, context: Context) {
  const path = (await context.params).path.join('/');
  if (path !== 'get-session') return Response.json({ error: 'Not found.' }, { status: 404 });
  if (!cloudConfigured()) return Response.json(null, { headers: { 'Cache-Control': 'no-store' } });
  return getAuth().handler().GET(req, context);
}
export async function POST(req: Request, context: Context) {
  const path = (await context.params).path.join('/');
  if (!postPaths.has(path)) return Response.json({ error: 'Not found.' }, { status: 404 });
  if (!cloudConfigured())
    return Response.json({ message: 'Account login is not configured.' }, { status: 503 });
  if (req.headers.get('origin') !== new URL(req.url).origin)
    return Response.json({ message: 'Invalid request origin.' }, { status: 403 });
  // Better Auth handles hashing, provider rate limits and signed session cookies.
  const raw = await req.text();
  if (raw.length > 16384) return Response.json({ message: 'Request too large.' }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return Response.json({ message: 'Invalid request.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return Response.json({ message: 'Invalid request.' }, { status: 400 });
  if (path === 'sign-up/email' || path === 'email-otp/reset-password') {
    if (
      typeof body.password !== 'string' ||
      body.password.length < 10 ||
      body.password.length > 128
    )
      return Response.json(
        { message: 'Use a password between 10 and 128 characters.' },
        { status: 400 },
      );
  }
  if (typeof body.email === 'string') body.email = body.email.trim().toLowerCase();
  return getAuth()
    .handler()
    .POST(new Request(req, { body: JSON.stringify(body) }), context);
}
