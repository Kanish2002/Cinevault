import { getMedia } from "@/lib/api/tmdb";
import {
  guard,
  errorResponse,
  mediaParams,
  regionSchema,
} from "@/lib/api/route";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  try {
    guard(req);
    const { type, id } = mediaParams(await params);
    const region = regionSchema.parse(
      new URL(req.url).searchParams.get("region") || "IN",
    );
    return Response.json(
      await getMedia(
        type,
        id,
        region,
        new URL(req.url).searchParams.get("refresh") === "1",
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
