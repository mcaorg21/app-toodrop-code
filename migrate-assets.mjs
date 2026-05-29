#!/usr/bin/env node
/**
 * migrate-assets.mjs
 *
 * Migrates ALL files from Mocha R2 → Google Cloud Storage (toodrop-app).
 * Uses the temporary migration endpoints on tdv4.mocha.app.
 *
 * Run: node migrate-assets.mjs
 * Resume: run again — already-migrated keys are skipped via log file.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, ".env") });

const MOCHA_BASE = "https://tdv4.mocha.app";
const MOCHA_TOKEN = "MIGRATE_TOODROP_2026";
const GCS_BUCKET = process.env.GCS_BUCKET_NAME || "toodrop-app";
const CONCURRENCY = 5;

// ---------------------------------------------------------------------------
// GCS setup
// ---------------------------------------------------------------------------
const keyJson = process.env.GCS_SERVICE_ACCOUNT_JSON;
let creds;
if (keyJson?.trim()) {
  creds = keyJson.trim().startsWith("{")
    ? JSON.parse(keyJson)
    : JSON.parse(Buffer.from(keyJson.trim(), "base64").toString("utf-8"));
}
const storage = creds ? new Storage({ credentials: creds }) : new Storage();
const bucket = storage.bucket(GCS_BUCKET);

// ---------------------------------------------------------------------------
// Progress log — resumable
// ---------------------------------------------------------------------------
const LOG_PATH = resolve(__dirname, "../migrate-assets-log.json");
const log = existsSync(LOG_PATH)
  ? JSON.parse(readFileSync(LOG_PATH, "utf-8"))
  : { done: [], failed: [] };
const doneSet = new Set(log.done);

function saveLog() {
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

// ---------------------------------------------------------------------------
// List all R2 keys via Mocha API
// ---------------------------------------------------------------------------
async function listAllKeys() {
  console.log("Listing all files from Mocha R2...");
  const resp = await fetch(`${MOCHA_BASE}/api/migrate/list?token=${MOCHA_TOKEN}`);
  if (!resp.ok) throw new Error(`List failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  console.log(`Total files in R2: ${data.total ?? data.keys?.length}`);
  return data.keys;
}

// ---------------------------------------------------------------------------
// Download one file from Mocha and upload to GCS
// ---------------------------------------------------------------------------
async function migrateOne(key) {
  const url = `${MOCHA_BASE}/api/migrate/file?key=${encodeURIComponent(key)}&token=${MOCHA_TOKEN}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  const contentType = resp.headers.get("content-type") || "application/octet-stream";

  await bucket.file(key).save(buffer, { contentType, resumable: false });
}

// ---------------------------------------------------------------------------
// Run with concurrency limit
// ---------------------------------------------------------------------------
async function runConcurrent(keys) {
  let idx = 0;
  let ok = 0;
  let fail = 0;
  const total = keys.length;

  async function worker() {
    while (idx < keys.length) {
      const key = keys[idx++];

      if (doneSet.has(key)) continue;

      try {
        await migrateOne(key);
        log.done.push(key);
        doneSet.add(key);
        ok++;
      } catch (e) {
        log.failed.push({ key, reason: e.message });
        fail++;
        process.stdout.write(`\n  FAIL ${key}: ${e.message}\n`);
      }

      const done = ok + fail + doneSet.size - ok - fail; // already-done count
      if ((ok + fail) % 10 === 0 && ok + fail > 0) {
        process.stdout.write(`  ${ok + fail + (doneSet.size - ok - fail)} / ${total} (${ok} ok, ${fail} fail)\r`);
        saveLog();
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  saveLog();
  return { ok, fail };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`GCS bucket  : ${GCS_BUCKET}`);
  console.log(`Log file    : ${LOG_PATH}`);
  console.log(`Already done: ${doneSet.size} files\n`);

  const allKeys = await listAllKeys();

  const pending = allKeys.filter(k => !doneSet.has(k));
  console.log(`To migrate  : ${pending.length} files (${doneSet.size} already done)\n`);

  if (pending.length === 0) {
    console.log("Nothing to do — all files already migrated!");
    return;
  }

  console.log(`Migrating with ${CONCURRENCY} concurrent workers...\n`);
  const { ok, fail } = await runConcurrent(pending);

  console.log(`\n\nDone! ${ok} migrated, ${fail} failed, ${doneSet.size - ok} already existed`);

  if (fail > 0) {
    console.log(`\nFailed files saved to migrate-assets-log.json`);
    for (const f of log.failed.slice(-10)) {
      console.log(`  ${f.key}: ${f.reason}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  saveLog();
  process.exit(1);
});
