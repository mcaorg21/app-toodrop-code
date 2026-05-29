#!/usr/bin/env node
// Migrates users table: replaces Mocha UUID mocha_user_id with Google sub,
// and fills in email/name for users who have them in users.json but not in DB.
// Also inserts users from users.json that don't exist in DB at all.

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
});

const users = JSON.parse(
  readFileSync(resolve(__dirname, "../users.json"), "utf-8")
);

console.log(`Loaded ${users.length} users from users.json`);

let updated = 0;
let inserted = 0;
let skipped = 0;

for (const u of users) {
  const googleSub = u.google_sub;
  const mochaId = u.id;
  const email = u.email || null;
  const name = u.google_user_data?.name || null;

  if (!googleSub) {
    console.warn(`  SKIP (no google_sub): ${email}`);
    skipped++;
    continue;
  }

  // Check if already migrated (mocha_user_id = google_sub)
  const already = await pool.query(
    "SELECT id FROM users WHERE mocha_user_id = $1",
    [googleSub]
  );
  if (already.rows.length > 0) {
    // Already correct — just update email/name if missing
    await pool.query(
      `UPDATE users SET
        email = COALESCE(NULLIF(email,''), $1),
        full_name = COALESCE(NULLIF(full_name,''), $2)
      WHERE mocha_user_id = $3`,
      [email, name, googleSub]
    );
    skipped++;
    continue;
  }

  // Check if exists by old Mocha UUID
  const byMocha = await pool.query(
    "SELECT id, email, full_name FROM users WHERE mocha_user_id = $1",
    [mochaId]
  );

  if (byMocha.rows.length > 0) {
    // Update: swap mocha_user_id to google_sub, fill email/name
    await pool.query(
      `UPDATE users SET
        mocha_user_id = $1,
        email = COALESCE(NULLIF(email,''), $2),
        full_name = COALESCE(NULLIF(full_name,''), $3)
      WHERE mocha_user_id = $4`,
      [googleSub, email, name, mochaId]
    );
    console.log(`  UPDATED: ${email} (${mochaId} → ${googleSub})`);
    updated++;
  } else {
    // Insert new minimal user
    await pool.query(
      `INSERT INTO users (mocha_user_id, email, full_name, profile_status, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'incomplete', 1, $4, $4)
       ON CONFLICT (mocha_user_id) DO NOTHING`,
      [googleSub, email, name, u.created_at]
    );
    console.log(`  INSERTED: ${email} (${googleSub})`);
    inserted++;
  }
}

console.log(`\nDone. Updated: ${updated}, Inserted: ${inserted}, Skipped/Already OK: ${skipped}`);
await pool.end();
