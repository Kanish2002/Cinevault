import { neon } from '@neondatabase/serverless';
import { readFile, readdir } from 'node:fs/promises';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured server-side.');
const sql = neon(process.env.DATABASE_URL);
const directory = new URL('../migrations/', import.meta.url);
for (const name of (await readdir(directory)).filter((name) => /^\d+_.*\.sql$/.test(name)).sort()) {
  const source = await readFile(new URL(name, directory), 'utf8');
  for (const statement of source
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await sql.query(statement);
}
console.log('CineVault sync migration completed.');
