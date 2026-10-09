import { z } from "zod";
import { tmdb, normalizeResult } from "@/lib/api/tmdb";
import { guard, errorResponse } from "@/lib/api/route";
export async function GET(req: Request) {
  try {
    guard(req);
    const p = new URL(req.url).searchParams;
    const type = z.enum(["movie", "tv"]).parse(p.get("type") || "movie"),
      id = z.coerce.number().int().positive().parse(p.get("id"));
    const d = await tmdb<{ results: unknown[] }>(
      `${type}/${id}/recommendations`,
      {},
      3600,
    );
    return Response.json({
      results: d.results.flatMap((x) => {
        const r = normalizeResult(x, type);
        return r ? [r] : [];
      }),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
