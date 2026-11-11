"use server"

import { revalidatePath } from "next/cache"

import { MAX_IMPORT_BYTES, parseCallsJson } from "@/lib/call-import"
import { redirect } from "next/navigation"

import {
  addReview,
  callExists,
  deleteCall as deleteCallRow,
  insertNewCalls,
} from "@/lib/data"
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

export type ImportCallsState =
  | { status: "idle" }
  | { status: "error"; fileName?: string; errors: string[]; errorCount: number }
  | {
      status: "done"
      fileName: string
      added: string[]
      /** Ids already in the database; their stored data was not changed. */
      skippedExisting: string[]
      /** Ids repeated inside the file; only the first occurrence was used. */
      repeatedInFile: string[]
    }

const MAX_ERRORS_SHOWN = 8

export async function importCalls(
  _prev: ImportCallsState,
  formData: FormData
): Promise<ImportCallsState> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", errors: ["Choose a JSON file to import."], errorCount: 1 }
  }
  const fileName = file.name
  if (file.size > MAX_IMPORT_BYTES) {
    const mb = (MAX_IMPORT_BYTES / 1_000_000).toFixed(1)
    return { status: "error", fileName, errors: [`The file is larger than ${mb} MB. Split it into smaller files.`], errorCount: 1 }
  }

  const parsed = parseCallsJson(await file.text())
  if (parsed.errors.length) {
    // All-or-nothing: a partly valid file imports nothing, so it can be fixed and re-run.
    return {
      status: "error",
      fileName,
      errors: parsed.errors.slice(0, MAX_ERRORS_SHOWN),
      errorCount: parsed.errors.length,
    }
  }

  try {
    const added = await insertNewCalls(parsed.calls)
    const addedSet = new Set(added)
    revalidatePath("/")
    return {
      status: "done",
      fileName,
      added,
      skippedExisting: parsed.calls.map((c) => c.id).filter((id) => !addedSet.has(id)),
      repeatedInFile: parsed.repeatedInFile,
    }
  } catch (err) {
    console.error("importCalls failed", err)
    return { status: "error", fileName, errors: ["Could not save the calls. Nothing was imported; please try again."], errorCount: 1 }
  }
}

export type DeleteCallState = { error?: string }

export async function deleteCall(
  _prev: DeleteCallState,
  formData: FormData
): Promise<DeleteCallState> {
  const callId = String(formData.get("callId") ?? "")
  if (!callId) return { error: "No call selected." }

  let result: Awaited<ReturnType<typeof deleteCallRow>>
  try {
    result = await deleteCallRow(callId)
  } catch (err) {
    console.error("deleteCall failed", err)
    return { error: "Could not delete the call. Please try again." }
  }

  revalidatePath("/")
  if (!result) {
    // Already gone (e.g. deleted in another tab); just move on.
    redirect("/")
  }
  // redirect() throws, so it must stay outside the try/catch above.
  const params = new URLSearchParams({ deleted: callId, reviews: String(result.reviewsDeleted) })
  redirect(`/?${params}`)
}
