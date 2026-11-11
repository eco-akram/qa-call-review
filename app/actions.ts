"use server"

import { revalidatePath } from "next/cache"

import { getCall } from "@/lib/calls"
import { DECISIONS, REASON_MAX, type Decision } from "@/lib/review-types"
import { writeReview } from "@/lib/reviews"

export type SaveReviewState = { ok: boolean; error?: string; savedAt?: string }

export async function saveReview(
  _prev: SaveReviewState,
  formData: FormData
): Promise<SaveReviewState> {
  const callId = String(formData.get("callId") ?? "")
  const decision = String(formData.get("decision") ?? "") as Decision
  const reason = String(formData.get("reason") ?? "").trim()

  if (!getCall(callId)) return { ok: false, error: "Unknown call." }
  if (!DECISIONS.includes(decision))
    return { ok: false, error: "Choose Approve, Reject or Needs edit." }
  if (decision !== "approve" && !reason)
    return { ok: false, error: "Add a short reason for this decision." }
  if (reason.length > REASON_MAX)
    return { ok: false, error: `Keep the reason under ${REASON_MAX} characters.` }

  const reviewedAt = new Date().toISOString()
  await writeReview({ callId, decision, reason, reviewedAt })
  revalidatePath("/")
  return { ok: true, savedAt: reviewedAt }
}
