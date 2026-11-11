import type { Call } from "@/lib/calls"

/** Upload cap; next.config allows 4 MB bodies, leaving room for multipart overhead. */
export const MAX_IMPORT_BYTES = 3_500_000
export const MAX_IMPORT_CALLS = 2_000

const FIELDS = ["id", "call_date", "estimated_duration", "transcript", "summary"] as const
const MAX_LENGTH: Record<(typeof FIELDS)[number], number> = {
  id: 64,
  call_date: 10,
  estimated_duration: 16,
  transcript: 200_000,
  summary: 20_000,
}

export type ParsedImport = {
  /** Valid calls, de-duplicated by id within the file (first one wins). */
  calls: Call[]
  /** Ids that appeared more than once in the file. */
  repeatedInFile: string[]
  /** Problems that block the import, e.g. "Call #3 (CALL-007): missing summary". */
  errors: string[]
}

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/**
 * Validates a JSON document in the data/candidate-calls.json format: an array
 * of { id, call_date, estimated_duration, transcript, summary }.
 */
export function parseCallsJson(text: string): ParsedImport {
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^﻿/, ""))
  } catch (err) {
    return { calls: [], repeatedInFile: [], errors: [`The file is not valid JSON: ${(err as Error).message}`] }
  }
  if (!Array.isArray(data)) {
    return { calls: [], repeatedInFile: [], errors: ["The file must contain a JSON array of calls."] }
  }
  if (data.length === 0) {
    return { calls: [], repeatedInFile: [], errors: ["The file contains no calls."] }
  }
  if (data.length > MAX_IMPORT_CALLS) {
    return { calls: [], repeatedInFile: [], errors: [`Import at most ${MAX_IMPORT_CALLS} calls at a time (file has ${data.length}).`] }
  }

  const calls: Call[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  const repeated = new Set<string>()

  data.forEach((item, i) => {
    const where = (id?: unknown) => `Call #${i + 1}${typeof id === "string" && id.trim() ? ` (${id.trim()})` : ""}`
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      errors.push(`${where()}: must be an object.`)
      return
    }
    const record = item as Record<string, unknown>
    const problems: string[] = []
    for (const field of FIELDS) {
      const value = record[field]
      if (typeof value !== "string" || !value.trim()) problems.push(`missing ${field}`)
      else if (value.length > MAX_LENGTH[field]) problems.push(`${field} is longer than ${MAX_LENGTH[field].toLocaleString("en-GB")} characters`)
    }
    if (typeof record.call_date === "string" && record.call_date.trim() && !isRealDate(record.call_date.trim())) {
      problems.push("call_date must be a real date in YYYY-MM-DD format")
    }
    if (problems.length) {
      errors.push(`${where(record.id)}: ${problems.join(", ")}.`)
      return
    }

    const call: Call = {
      id: (record.id as string).trim(),
      call_date: (record.call_date as string).trim(),
      estimated_duration: (record.estimated_duration as string).trim(),
      transcript: record.transcript as string,
      summary: record.summary as string,
    }
    if (seen.has(call.id)) {
      repeated.add(call.id)
      return
    }
    seen.add(call.id)
    calls.push(call)
  })

  return { calls, repeatedInFile: [...repeated], errors }
}
