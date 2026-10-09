import NextAuth from "next-auth";
import { authOptions, cloudConfigured } from "@/lib/sync/auth";
const handler = NextAuth(authOptions);
export async function GET(req: Request, context: unknown) {
  if (!cloudConfigured()) {
    const path = new URL(req.url).pathname;
    if (path.endsWith("/session")) return Response.json(null);
    if (path.endsWith("/providers")) return Response.json({});
    return Response.json(
      { error: "Cloud sign-in is not configured." },
      { status: 503 },
    );
  }
  return handler(req, context);
}
export async function POST(req: Request, context: unknown) {
  if (!cloudConfigured())
    return Response.json(
      { error: "Cloud sign-in is not configured." },
      { status: 503 },
    );
  return handler(req, context);
}
