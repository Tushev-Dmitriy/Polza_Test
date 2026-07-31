import { db } from "../lib/db";

async function main(): Promise<void> {
  const [totals, runs, rejectionReasons] = await Promise.all([
    db.query(`SELECT COUNT(*) AS companies, COUNT(DISTINCT city) AS cities,
                     COUNT(DISTINCT category) AS categories FROM companies`),
    db.query(`SELECT source, rows_seen, inserted, updated, duplicates, rejected,
                     finished_at FROM import_runs ORDER BY id`),
    db.query(`SELECT reason, COUNT(*)::int AS count
              FROM import_rejections, unnest(reasons) AS reason
              GROUP BY reason ORDER BY count DESC, reason`),
  ]);

  console.log("Database totals:", totals.rows[0]);
  console.table(runs.rows);
  console.log("Rejected row reasons:");
  console.table(rejectionReasons.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
