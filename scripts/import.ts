import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { db } from "../lib/db";
import { validateCompany } from "../lib/normalize";
import type { CompanyInput, RawCompany } from "../lib/types";

type ImportMode = "json" | "review" | "all";
type SourceRow = { record: RawCompany; sourceFile: string; rowNumber: number };
type Counters = { seen: number; inserted: number; updated: number; duplicates: number; rejected: number };

async function loadJsonRows(): Promise<SourceRow[]> {
  const directory = path.resolve("data_pack");
  const files = (await readdir(directory))
    .filter((file) => /^page_\d{3}\.json$/.test(file))
    .sort();
  const rows: SourceRow[] = [];

  for (const file of files) {
    const body = JSON.parse(await readFile(path.join(directory, file), "utf8")) as {
      page: number;
      per_page: number;
      total: number;
      items: RawCompany[];
    };
    if (!Array.isArray(body.items)) throw new Error(`${file}: "items" must be an array`);
    body.items.forEach((record, index) => {
      rows.push({ record, sourceFile: file, rowNumber: index + 1 });
    });
  }
  return rows;
}

async function loadReviewRows(): Promise<SourceRow[]> {
  const file = path.resolve("data_pack", "review.csv");
  const content = await readFile(file, "utf8");
  const records = parse(content, {
    columns: true,
    bom: true,
    skip_empty_lines: false,
    relax_column_count: false,
    trim: false,
  }) as RawCompany[];
  return records.map((record, index) => ({
    record,
    sourceFile: "review.csv",
    rowNumber: index + 2,
  }));
}

async function saveRejection(
  runId: string,
  row: SourceRow,
  reasons: string[],
): Promise<void> {
  await db.query(
    `INSERT INTO import_rejections
       (import_run_id, source_file, row_number, source_id, reasons, raw_record)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      runId,
      row.sourceFile,
      row.rowNumber,
      typeof row.record.id === "string" ? row.record.id.trim() || null : null,
      reasons,
      JSON.stringify(row.record),
    ],
  );
}

async function upsertCompany(company: CompanyInput, sourceFile: string): Promise<"inserted" | "updated" | "duplicate"> {
  const existing = await db.query<{ source_id: string; dedupe_key: string }>(
    `SELECT source_id, dedupe_key
     FROM companies
     WHERE source_id = $1 OR dedupe_key = $2
     LIMIT 1`,
    [company.sourceId, company.dedupeKey],
  );

  if (existing.rowCount) {
    const match = existing.rows[0];
    if (match.source_id !== company.sourceId) return "duplicate";
    await db.query(
      `UPDATE companies SET
         name = $2, category = $3, city = $4, address = $5, rating = $6,
         reviews_count = $7, site = $8, phone = $9, dedupe_key = $10,
         source_file = $11, imported_at = NOW()
       WHERE source_id = $1`,
      [
        company.sourceId, company.name, company.category, company.city,
        company.address, company.rating, company.reviewsCount, company.site,
        company.phone, company.dedupeKey, sourceFile,
      ],
    );
    return "updated";
  }

  await db.query(
    `INSERT INTO companies
       (source_id, name, category, city, address, rating, reviews_count,
        site, phone, dedupe_key, source_file)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      company.sourceId, company.name, company.category, company.city,
      company.address, company.rating, company.reviewsCount, company.site,
      company.phone, company.dedupeKey, sourceFile,
    ],
  );
  return "inserted";
}

async function importRows(label: string, rows: SourceRow[]): Promise<Counters> {
  const run = await db.query<{ id: string }>(
    "INSERT INTO import_runs (source) VALUES ($1) RETURNING id::text",
    [label],
  );
  const runId = run.rows[0].id;
  const counters: Counters = { seen: rows.length, inserted: 0, updated: 0, duplicates: 0, rejected: 0 };
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();

  for (const row of rows) {
    const result = validateCompany(row.record);
    if (!result.ok) {
      await saveRejection(runId, row, result.reasons);
      counters.rejected += 1;
      continue;
    }
    if (seenIds.has(result.value.sourceId) || seenKeys.has(result.value.dedupeKey)) {
      counters.duplicates += 1;
      continue;
    }
    seenIds.add(result.value.sourceId);
    seenKeys.add(result.value.dedupeKey);
    const outcome = await upsertCompany(result.value, row.sourceFile);
    if (outcome === "duplicate") counters.duplicates += 1;
    else counters[outcome] += 1;
  }

  await db.query(
    `UPDATE import_runs SET
       finished_at = NOW(), rows_seen = $2, inserted = $3, updated = $4,
       duplicates = $5, rejected = $6
     WHERE id = $1`,
    [runId, counters.seen, counters.inserted, counters.updated, counters.duplicates, counters.rejected],
  );
  return counters;
}

async function main(): Promise<void> {
  const mode = (process.argv[2] ?? "all") as ImportMode;
  if (!["json", "review", "all"].includes(mode)) {
    throw new Error("Usage: npm run db:import -- [json|review|all]");
  }

  if (mode === "json" || mode === "all") {
    const result = await importRows("JSON pages", await loadJsonRows());
    console.log("JSON pages:", result);
  }
  if (mode === "review" || mode === "all") {
    const result = await importRows("review.csv", await loadReviewRows());
    console.log("review.csv:", result);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
