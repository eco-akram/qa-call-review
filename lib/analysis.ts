import type { Call, Turn } from "@/lib/calls"
import { parseTranscript } from "@/lib/calls"
import {
  checkFacts,
  extractSummaryFacts,
  extractTranscriptFacts,
  type FactIssue,
} from "@/lib/facts"
import {
  buildIndex,
  matchSentence,
  splitSentences,
  type SentenceMatch,
} from "@/lib/matching"

export type SentenceAnalysis = SentenceMatch & {
  text: string
  issues: FactIssue[]
}

export type CallAnalysis = {
  turns: Turn[]
  sentences: SentenceAnalysis[]
  conflictCount: number
  unsupportedCount: number
}

/** Splits the summary, finds evidence turns and checks facts per sentence. */
export function analyseCall(call: Pick<Call, "transcript" | "summary" | "call_date">): CallAnalysis {
  const turns = parseTranscript(call.transcript)
  const index = buildIndex(turns)
  const transcriptFacts = extractTranscriptFacts(turns, call.call_date)

  const sentences = splitSentences(call.summary).map((text) => {
    const match = matchSentence(index, text)
    const issues = checkFacts(
      extractSummaryFacts(text, call.call_date),
      transcriptFacts,
      match.matches.map((m) => m.turnId)
    )
    return { ...match, text, issues }
  })

  const all = sentences.flatMap((s) => s.issues)
  return {
    turns,
    sentences,
    conflictCount: all.filter((i) => i.kind === "conflict").length,
    unsupportedCount: all.filter((i) => i.kind === "unsupported").length,
  }
}
