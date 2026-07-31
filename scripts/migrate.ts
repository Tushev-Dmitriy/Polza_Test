import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../lib/db";

async function main(): Promise<void> {
  const schemaPath = path.resolve("sql", "schema.sql");
  const schema = await readFile(schemaPath, "utf8");
  await db.query(schema);
  console.log(`Database schema applied from ${path.relative(process.cwd(), schemaPath)}`);
}

main()
  .catch((error) => {
    console.error("Failed to apply database schema:", error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
