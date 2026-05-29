#!/usr/bin/env node
/**
 * migrate-d1-data.mjs
 *
 * Full re-sync from d1_dump.sql to Railway PostgreSQL.
 * - TRUNCATEs all data tables then re-inserts from dump.
 * - Preserves original integer IDs so FK relationships stay intact.
 * - For Google OAuth users: swaps mocha_user_id (Mocha UUID) → Google sub (via users.json).
 * - For email_auth users: keeps mocha_user_id as-is.
 *
 * Run from: C:\www\app-toodrop\code\
 *   node migrate-d1-data.mjs
 */

import { readFileSync } from "fs";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, ".env") });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  keepAlive: true,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000,
});

const dumpSql = readFileSync(resolve(__dirname, "../d1_dump.sql"), "utf-8");
const usersJson = JSON.parse(
  readFileSync(resolve(__dirname, "../users.json"), "utf-8")
);

// Mocha UUID → Google sub
const mochaToGoogleSub = new Map();
for (const u of usersJson) {
  if (u.id && u.google_sub) {
    mochaToGoogleSub.set(u.id, u.google_sub);
  }
}
console.log(`Loaded ${mochaToGoogleSub.size} Mocha UUID → Google sub mappings`);

// ---------------------------------------------------------------------------
// SQLite VALUES parser
// Handles: NULL, integers, reals (incl. negative), single-quoted strings with '' escapes
// ---------------------------------------------------------------------------
function parseValues(str) {
  const values = [];
  let i = 0;
  const len = str.length;

  while (i < len) {
    while (i < len && (str[i] === "," || str[i] === " ")) i++;
    if (i >= len) break;

    if (str[i] === "'") {
      i++;
      let s = "";
      while (i < len) {
        if (str[i] === "'" && i + 1 < len && str[i + 1] === "'") {
          s += "'";
          i += 2;
        } else if (str[i] === "'") {
          i++;
          break;
        } else {
          s += str[i++];
        }
      }
      values.push(s);
    } else if (str.startsWith("NULL", i)) {
      values.push(null);
      i += 4;
    } else {
      let n = "";
      while (i < len && str[i] !== ",") n += str[i++];
      n = n.trim();
      if (n === "") continue;
      values.push(n.includes(".") ? parseFloat(n) : parseInt(n, 10));
    }
  }

  return values;
}

// ---------------------------------------------------------------------------
// Parse all INSERT statements from the dump
// ---------------------------------------------------------------------------
function parseDump(sql) {
  const tables = {};
  const lines = sql.split("\n");

  for (const line of lines) {
    const m = line.match(/^INSERT INTO "([^"]+)" \(([^)]+)\) VALUES\((.*)\);$/);
    if (!m) continue;

    const tableName = m[1];
    if (tableName === "_mocha_migrations" || tableName === "sqlite_sequence") continue;

    const columns = m[2].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const values = parseValues(m[3]);

    if (values.length !== columns.length) {
      console.warn(`  SKIP ${tableName} row: expected ${columns.length} cols, got ${values.length}`);
      continue;
    }

    if (!tables[tableName]) tables[tableName] = { columns, rows: [] };
    tables[tableName].rows.push(values);
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Swap mocha_user_id for Google OAuth users
// ---------------------------------------------------------------------------
function swapMochaIds(tables) {
  const usersData = tables["users"];
  if (!usersData) return;

  const mochaIdx = usersData.columns.indexOf("mocha_user_id");
  if (mochaIdx === -1) return;

  let swapped = 0;
  let noMatch = 0;

  usersData.rows = usersData.rows.map((row) => {
    const mochaId = row[mochaIdx];
    if (typeof mochaId !== "string") return row;

    // Mocha UUID pattern
    if (/^[0-9a-f]{8}-/.test(mochaId)) {
      const googleSub = mochaToGoogleSub.get(mochaId);
      if (googleSub) {
        const newRow = [...row];
        newRow[mochaIdx] = googleSub;
        swapped++;
        return newRow;
      } else {
        console.warn(`  No Google sub for Mocha UUID: ${mochaId} — keeping UUID`);
        noMatch++;
      }
    }
    return row;
  });

  console.log(`  users: ${swapped} swapped to Google sub, ${noMatch} kept as UUID`);
}

// ---------------------------------------------------------------------------
// Insert rows for a table using batch inserts (BATCH_SIZE rows per query)
// ---------------------------------------------------------------------------
const BATCH_SIZE = 50;

async function insertTable(client, tableName, columns, rows) {
  if (rows.length === 0) return 0;

  const colList = columns.map((c) => `"${c}"`).join(", ");
  let inserted = 0;
  let errors = 0;

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const params = [];
    const rowPhs = batch.map((row) => {
      const phs = row.map((val) => {
        params.push(val);
        return `$${params.length}`;
      });
      return `(${phs.join(", ")})`;
    });

    const sql = `INSERT INTO "${tableName}" (${colList}) VALUES ${rowPhs.join(", ")} ON CONFLICT DO NOTHING`;
    try {
      const r = await client.query(sql, params);
      inserted += r.rowCount || 0;
    } catch (err) {
      if (errors < 3) {
        console.error(`  Error in ${tableName} batch @${offset}: ${err.message}`);
      }
      errors++;
      // Fall back to row-by-row for failed batch
      for (const row of batch) {
        const phs = row.map((_, i) => `$${i + 1}`).join(", ");
        try {
          const r2 = await client.query(
            `INSERT INTO "${tableName}" (${colList}) VALUES (${phs}) ON CONFLICT DO NOTHING`,
            row
          );
          inserted += r2.rowCount || 0;
        } catch {
          // skip bad row silently
        }
      }
    }
  }

  if (errors > 0) console.warn(`  ${tableName}: ${errors} batch errors (fell back row-by-row)`);
  return inserted;
}

// ---------------------------------------------------------------------------
// Reset sequences to max(id) so future INSERTs don't conflict
// ---------------------------------------------------------------------------
async function resetSequences(client, tableNames) {
  for (const t of tableNames) {
    try {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE(MAX(id), 1)) FROM "${t}"`
      );
    } catch {
      // Table may not have a serial id — skip
    }
  }
  console.log("  sequences reset");
}

// ---------------------------------------------------------------------------
// Tables in FK dependency order (insert order)
// ---------------------------------------------------------------------------
const TABLE_ORDER = [
  "email_credentials",
  "email_verification_codes",
  "users",
  "addresses",
  "receiver_docs",
  "receiver_doc_validations",
  "admins",
  "receiver_point_status",
  "hub_location_logs",
  "schedules",
  "delivery_driver_locations",
  "droptags",
  "droptag_authorized_receivers",
  "delivery_scans",
  "driver_deliveries",
  "receiver_deliveries",
  "secret_word_attempts",
  "asaas_charges",
  "platform_commissions",
  "commission_history",
  "saved_cards",
  "user_transactions",
  "withdrawal_requests",
  "referrals",
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Parsing d1_dump.sql...");
  const tables = parseDump(dumpSql);

  console.log("\nRows found per table:");
  for (const t of TABLE_ORDER) {
    if (tables[t]) console.log(`  ${t}: ${tables[t].rows.length}`);
  }

  console.log("\nSwapping mocha_user_id → Google sub...");
  swapMochaIds(tables);

  // Phase 1: TRUNCATE everything in one transaction (fast)
  {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      console.log("\nTruncating tables...");
      for (const t of [...TABLE_ORDER].reverse()) {
        try {
          await client.query(`TRUNCATE "${t}" RESTART IDENTITY CASCADE`);
          process.stdout.write(".");
        } catch (err) {
          console.error(`\n  Failed to truncate ${t}: ${err.message}`);
        }
      }
      await client.query("COMMIT");
      console.log("\nTruncate done.\n");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // Phase 2: Insert each table in its own transaction (connection failures don't lose progress)
  console.log("Inserting...");
  for (const t of TABLE_ORDER) {
    const data = tables[t];
    if (!data) continue;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const count = await insertTable(client, t, data.columns, data.rows);
      await client.query("COMMIT");
      console.log(`  ${t}: ${data.rows.length} → ${count} inserted`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`  ${t}: FAILED — ${err.message}`);
    } finally {
      client.release();
    }
  }

  // Phase 3: Reset sequences
  {
    const client = await pool.connect();
    try {
      console.log("\nResetting sequences...");
      await resetSequences(client, TABLE_ORDER);
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
