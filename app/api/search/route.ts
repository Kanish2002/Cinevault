import { z } from "zod";
import { search } from "@/lib/api/tmdb";
import { guard, errorResponse } from "@/lib/api/route";
export async function GET(req: Request) {
  try {
    guard(req);
    const q = z
      .string()
      .trim()
      .min(1)
      .max(160)
      .parse(new URL(req.url).searchParams.get("q"));
    return Response.json({ results: await search(q) });
  } catch (e) {
    return errorResponse(e);
  }
}
