import { getMedia } from "@/lib/api/tmdb";
import { guard, errorResponse, mediaParams } from "@/lib/api/route";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  try {
    guard(req);
    const { type, id } = mediaParams(await params);
    const m = await getMedia(type, id);
    return Response.json({
      imdbRating: m.imdbRating,
      imdbVotes: m.imdbVotes,
      ratingsState: m.ratingsState,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
