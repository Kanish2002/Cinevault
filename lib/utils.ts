import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export function languageName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code;
  } catch {
    return code || "Unknown";
  }
}
export const year = (date: string) => date?.slice(0, 4) || "Year unknown";
export const poster = (path: string | null, size = "w342") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, options);
  const data = await r
    .json()
    .catch(() => ({ error: "Unexpected server response" }));
  if (!r.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data as T;
}
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
