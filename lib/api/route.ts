import { z } from "zod";
import { ProviderError } from "./tmdb";
const buckets = new Map<string, { count: number; until: number }>();
export function guard(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const current = buckets.get(ip),
    time = Date.now();
  if (current && current.until > time) {
    current.count++;
    if (current.count > 120)
      throw new ProviderError(
        "Too many requests. Please wait one minute.",
        429,
      );
  } else buckets.set(ip, { count: 1, until: time + 60000 });
  if (buckets.size > 10000)
    for (const [key, b] of buckets) if (b.until < time) buckets.delete(key);
}
export function errorResponse(e: unknown) {
  if (e instanceof ProviderError)
    return Response.json(
      { error: e.message },
      {
        status: e.status,
        headers: e.status === 429 ? { "Retry-After": "60" } : {},
      },
    );
  if (e instanceof z.ZodError)
    return Response.json(
      {
        error: "Invalid request. Check the title, region or media identifier.",
      },
      { status: 400 },
    );
  return Response.json(
    { error: "The request could not be completed. Please retry." },
    { status: 502 },
  );
}
export const regionSchema = z.string().regex(/^[A-Z]{2}$/);
export function mediaParams(params: { type: string; id: string }) {
  return z
    .object({
      type: z.enum(["movie", "tv"]),
      id: z.coerce.number().int().positive().max(2147483647),
    })
    .parse(params);
}
