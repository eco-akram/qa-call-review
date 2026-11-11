// Creates the schema and loads calls (and any legacy file-based reviews) into Neon.
//
//   npm run db:setup                         # schema + data/candidate-calls.json
//   npm run db:setup -- path/to/calls.json   # schema + another batch of calls
//
// Safe to re-run: tables are created if missing, calls are upserted by id, and
// reviews from data/reviews.json are only imported once.

import { readFile } from "node:fs/promises"
import path from "node:path"

import { neon } from "@neondatabase/serverless"

const root = path.resolve(import.meta.dirname, "..")
const callsPath = path.resolve(process.argv[2] ?? path.join(root, "data/candidate-calls.json"))
const legacyReviewsPath = path.join(root, "data/reviews.json")

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is not set. Put your Neon connection string in .env.")
  process.exit(1)
}
const sql = neon(url)

// 1. Schema ------------------------------------------------------------------
const schema = await readFile(path.join(root, "db/schema.sql"), "utf8")
const statements = schema
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean)
for (const statement of statements) await sql.query(statement)
console.log(`Schema ready (${statements.length} statements).`)

// 2. Calls -------------------------------------------------------------------
const calls = JSON.parse(await readFile(callsPath, "utf8"))
if (!Array.isArray(calls)) throw new Error(`${callsPath} must contain a JSON array of calls.`)

const FIELDS = ["id", "call_date", "estimated_duration", "transcript", "summary"]
calls.forEach((c, i) => {
  const missing = FIELDS.filter((f) => typeof c?.[f] !== "string" || !c[f].trim())
  if (missing.length) throw new Error(`Call #${i + 1} (${c?.id ?? "no id"}) is missing: ${missing.join(", ")}`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.call_date)) throw new Error(`Call ${c.id}: call_date must be YYYY-MM-DD`)
})

const upserted = await sql.transaction(
  calls.map(
    (c) => sql`
      INSERT INTO calls (id, call_date, estimated_duration, transcript, summary)
      VALUES (${c.id}, ${c.call_date}, ${c.estimated_duration}, ${c.transcript}, ${c.summary})
      ON CONFLICT (id) DO UPDATE SET
        call_date          = EXCLUDED.call_date,
        estimated_duration = EXCLUDED.estimated_duration,
        transcript         = EXCLUDED.transcript,
        summary            = EXCLUDED.summary,
        updated_at         = now()
      WHERE (calls.call_date, calls.estimated_duration, calls.transcript, calls.summary)
        IS DISTINCT FROM
            (EXCLUDED.call_date, EXCLUDED.estimated_duration, EXCLUDED.transcript, EXCLUDED.summary)
      RETURNING (xmax = 0) AS inserted
    `
  )
)
const rows = upserted.flat()
const inserted = rows.filter((r) => r.inserted).length
console.log(
  `Calls from ${path.relative(root, callsPath)}: ${inserted} added, ${rows.length - inserted} updated, ${calls.length - rows.length} unchanged.`
)

// 3. Legacy reviews from the file-based version of the app -------------------
let legacy = null
try {
  legacy = JSON.parse(await readFile(legacyReviewsPath, "utf8"))
} catch (err) {
  if (err.code !== "ENOENT") throw err
}
if (legacy) {
  const reviews = Object.values(legacy)
  const results = await sql.transaction(
    reviews.map(
      (r) => sql`
        INSERT INTO reviews (call_id, decision, reason, created_at)
        SELECT ${r.callId}, ${r.decision}, ${r.reason ?? ""}, ${r.reviewedAt}
        WHERE EXISTS (SELECT 1 FROM calls WHERE id = ${r.callId})
          AND NOT EXISTS (
            SELECT 1 FROM reviews WHERE call_id = ${r.callId} AND created_at = ${r.reviewedAt}
          )
        RETURNING id
      `
    )
  )
  const imported = results.flat().length
  console.log(`Reviews from data/reviews.json: ${imported} imported, ${reviews.length - imported} already present or skipped.`)
}

const [{ calls: callCount, reviews: reviewCount }] = await sql`
  SELECT (SELECT count(*) FROM calls)::int AS calls, (SELECT count(*) FROM reviews)::int AS reviews
`
console.log(`Database now has ${callCount} calls and ${reviewCount} reviews.`)
