import { redirect } from "next/navigation";
export default async function Capture({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; text?: string; url?: string }>;
}) {
  const p = await searchParams;
  const text = (p.text || p.title || "").slice(0, 160);
  redirect(`/?capture=1&q=${encodeURIComponent(text)}`);
}
