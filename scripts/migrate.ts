import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL must be configured server-side.");
const sql = neon(process.env.DATABASE_URL);
const source = await readFile(
  new URL("../migrations/0001_sync.sql", import.meta.url),
  "utf8",
);
for (const statement of source
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--")))
  await sql.query(statement);
console.log("CineVault sync migration completed.");
