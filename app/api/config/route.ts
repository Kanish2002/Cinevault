export async function GET() {
  return Response.json(
    {
      tmdb: !!process.env.TMDB_API_READ_ACCESS_TOKEN,
      omdb: !!process.env.OMDB_API_KEY,
      cloud: !!(
        process.env.DATABASE_URL &&
        process.env.NEXTAUTH_SECRET &&
        process.env.GITHUB_CLIENT_ID &&
        process.env.GITHUB_CLIENT_SECRET
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
