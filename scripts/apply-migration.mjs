import { readFileSync } from "node:fs";
import { Client } from "pg";

const connectionString = process.env.POSTGRES_URL_NON_POOLING;
if (!connectionString) {
  console.error("Falta POSTGRES_URL_NON_POOLING");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/apply-migration.mjs <ruta.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const url = new URL(connectionString);
url.searchParams.delete("sslmode");
const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    "select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'notification_logs_status_check'",
  );
  console.log("Migración aplicada. Constraint actual:");
  console.log(rows[0]?.def ?? "(no encontrada)");
} catch (error) {
  console.error("Error aplicando la migración:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
