import { z } from "zod";
import { tmdb, normalizeResult } from "@/lib/api/tmdb";
import { guard, errorResponse } from "@/lib/api/route";
export async function GET(req: Request) {
  try {
    guard(req);
    const p = new URL(req.url).searchParams;
    const kind = z
      .enum([
        "trending",
        "popular",
        "top",
        "upcoming",
        "tv",
        "regional",
        "genre",
        "similar",
      ])
      .parse(p.get("kind") || "trending");
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .parse(p.get("page") || 1);
    let path = "trending/movie/week";
    const params: Record<string, string> = {
      page: String(page),
      include_adult: "false",
      language: "en-US",
    };
    let type: "movie" | "tv" = "movie";
    if (kind === "popular") path = "movie/popular";
    if (kind === "top") path = "movie/top_rated";
    if (kind === "upcoming") path = "movie/upcoming";
    if (kind === "tv") {
      path = "trending/tv/week";
      type = "tv";
    }
    if (kind === "regional" || kind === "genre") {
      path = "discover/movie";
      if (p.get("language"))
        params.with_original_language = z
          .string()
          .regex(/^[a-z]{2,3}$/)
          .parse(p.get("language"));
      if (p.get("genre"))
        params.with_genres = String(
          z.coerce.number().int().positive().parse(p.get("genre")),
        );
    }
    if (kind === "similar") {
      type = z.enum(["movie", "tv"]).parse(p.get("type"));
      path = `${type}/${z.coerce.number().int().positive().parse(p.get("id"))}/similar`;
    }
    const data = await tmdb<{ results: unknown[]; total_pages: number }>(
      path,
      params,
      1800,
    );
    return Response.json({
      results: data.results.flatMap((d) => {
        const r = normalizeResult(d, type);
        return r ? [r] : [];
      }),
      totalPages: data.total_pages,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
