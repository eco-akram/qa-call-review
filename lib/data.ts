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
