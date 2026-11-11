"use server"

import { revalidatePath } from "next/cache"

import { addReview, callExists } from "@/lib/data"
import { DECISIONS, REASON_MAX, type Decision } from "@/lib/review-types"

export type SaveReviewState = { ok: boolean; error?: string; savedAt?: string }

export async function saveReview(
  _prev: SaveReviewState,
  formData: FormData
): Promise<SaveReviewState> {
  const callId = String(formData.get("callId") ?? "")
  const decision = String(formData.get("decision") ?? "") as Decision
  const reason = String(formData.get("reason") ?? "").trim()

  if (!DECISIONS.includes(decision))
    return { ok: false, error: "Choose Approve, Reject or Needs edit." }
  if (decision !== "approve" && !reason)
    return { ok: false, error: "Add a short reason for this decision." }
  if (reason.length > REASON_MAX)
    return { ok: false, error: `Keep the reason under ${REASON_MAX} characters.` }

  try {
    if (!(await callExists(callId))) return { ok: false, error: "Unknown call." }
    const saved = await addReview({ callId, decision, reason })
    revalidatePath("/")
    return { ok: true, savedAt: saved.reviewedAt }
  } catch (err) {
    console.error("saveReview failed", err)
    return { ok: false, error: "Could not save the review. Please try again." }
  }
}
