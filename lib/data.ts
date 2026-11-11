import type { Call } from "@/lib/calls"
import { db } from "@/lib/db"
import type { Decision, Review, ReviewMap } from "@/lib/review-types"

// Server-only data access for calls and reviews.

const toIso = (v: Date | string) => new Date(v).toISOString()

export async function listCalls(): Promise<Call[]> {
  const rows = await db()`
    SELECT id, call_date::text AS call_date, estimated_duration, transcript, summary
    FROM calls
    ORDER BY id
  `
  return rows as Call[]
}

/**
 * Inserts calls whose id is not already stored. Existing calls are left
 * untouched (ON CONFLICT DO NOTHING). Returns the ids that were added.
 */
export async function insertNewCalls(calls: Call[]): Promise<string[]> {
  if (calls.length === 0) return []
  const sql = db()
  const results = await sql.transaction(
    calls.map(
      (c) => sql`
        INSERT INTO calls (id, call_date, estimated_duration, transcript, summary)
        VALUES (${c.id}, ${c.call_date}, ${c.estimated_duration}, ${c.transcript}, ${c.summary})
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `
    )
  )
  return results.flat().map((r) => r.id as string)
}

/** Number of review decisions (full history) recorded for a call. */
export async function countReviews(callId: string): Promise<number> {
  const [row] = await db()`SELECT count(*)::int AS n FROM reviews WHERE call_id = ${callId}`
  return row.n as number
}

/**
 * Deletes a call. Its reviews are removed with it (ON DELETE CASCADE).
 * Returns null if the call did not exist.
 */
export async function deleteCall(
  id: string
): Promise<{ reviewsDeleted: number } | null> {
  const [row] = await db()`
    WITH r AS (SELECT count(*)::int AS n FROM reviews WHERE call_id = ${id}),
         d AS (DELETE FROM calls WHERE id = ${id} RETURNING id)
    SELECT (SELECT count(*) FROM d)::int AS deleted, (SELECT n FROM r) AS reviews
  `
  return row.deleted ? { reviewsDeleted: row.reviews as number } : null
}

export async function callExists(id: string): Promise<boolean> {
  const rows = await db()`SELECT 1 FROM calls WHERE id = ${id}`
  return rows.length > 0
}

/** The most recent review for each call. */
export async function latestReviews(): Promise<ReviewMap> {
  const rows = await db()`
    SELECT DISTINCT ON (call_id) call_id, decision, reason, created_at
    FROM reviews
    ORDER BY call_id, created_at DESC, id DESC
  `
  return Object.fromEntries(
    rows.map((r) => [
      r.call_id,
      {
        callId: r.call_id,
        decision: r.decision as Decision,
        reason: r.reason,
        reviewedAt: toIso(r.created_at),
      } satisfies Review,
    ])
  )
}

export async function addReview(
  review: Omit<Review, "reviewedAt">
): Promise<Review> {
  const [row] = await db()`
    INSERT INTO reviews (call_id, decision, reason)
    VALUES (${review.callId}, ${review.decision}, ${review.reason})
    RETURNING created_at
  `
  return { ...review, reviewedAt: toIso(row.created_at) }
}
