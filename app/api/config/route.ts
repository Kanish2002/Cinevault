import { cloudConfigured } from '@/lib/sync/auth';

export async function GET() {
  return Response.json(
    {
      tmdb: !!process.env.TMDB_API_READ_ACCESS_TOKEN,
      omdb: !!process.env.OMDB_API_KEY,
      cloud: cloudConfigured(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
