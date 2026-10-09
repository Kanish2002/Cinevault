import { providers } from "@/lib/api/tmdb";
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
    return Response.json(
      await providers(
        type,
        id,
        regionSchema.parse(new URL(req.url).searchParams.get("region") || "IN"),
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
