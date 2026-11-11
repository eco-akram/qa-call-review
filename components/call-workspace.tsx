"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { ReviewPanel } from "@/components/review-panel"
import { SummarySentences } from "@/components/summary-sentences"
import { TranscriptPanel, type TurnFlag } from "@/components/transcript-panel"
import type { Call } from "@/lib/calls"
import { analyseCall } from "@/lib/analysis"
import { factTypeLabel } from "@/lib/facts"
import type { Review } from "@/lib/review-types"

function scrollToTurn(turnId: string) {
  // Wait a frame so newly applied highlights are in the DOM.
  requestAnimationFrame(() =>
    document
      .getElementById(turnId)
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
  )
}

export function CallWorkspace({
  call,
  existing,
}: {
  call: Pick<Call, "id" | "transcript" | "summary" | "call_date">
  existing: Review | undefined
}) {
  const analysis = useMemo(() => analyseCall(call), [call])
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const active = selected === null ? null : analysis.sentences[selected]

  // Transcript wording that a selected sentence's flagged facts conflict with.
  const flags = useMemo(() => {
    const map = new Map<string, TurnFlag[]>()
    for (const issue of active?.issues ?? []) {
      for (const c of issue.candidates) {
        if (!c.turnId) continue
        const list = map.get(c.turnId) ?? []
        list.push({ start: c.start, end: c.end, label: `Summary says ${issue.fact.quote}` })
        map.set(c.turnId, list)
      }
    }
    return map
  }, [active])

  const selectSentence = useCallback(
    (i: number) => {
      const next = selected === i ? null : i
      setSelected(next)
      const top = next === null ? undefined : analysis.sentences[next].matches[0]
      if (top) scrollToTurn(top.turnId)
    },
    [selected, analysis]
  )

  const showTurn = useCallback((sentence: number, turnId: string) => {
    setSelected(sentence)
    scrollToTurn(turnId)
  }, [])

  // Short descriptions of flagged facts, for the "Approve anyway?" guard.
  const flaggedIssues = useMemo(
    () =>
      analysis.sentences.flatMap((s, i) =>
        s.issues.map((issue) =>
          issue.kind === "conflict"
            ? `S${i + 1}: possible wrong ${factTypeLabel(issue.fact.type)} “${issue.fact.quote}”`
            : `S${i + 1}: ${factTypeLabel(issue.fact.type)} “${issue.fact.quote}” not in transcript`
        )
      ),
    [analysis]
  )

  /** Selects the first flagged sentence and scrolls to its evidence. */
  const showFirstIssue = useCallback(() => {
    const i = analysis.sentences.findIndex((s) => s.issues.length > 0)
    if (i === -1) return
    setSelected(i)
    const s = analysis.sentences[i]
    const turnId = s.issues[0].candidates[0]?.turnId ?? s.matches[0]?.turnId
    if (turnId) scrollToTurn(turnId)
    document
      .querySelector(`[data-sentence="${i}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [analysis])

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2">
      <TranscriptPanel
        turns={analysis.turns}
        matches={active?.matches ?? null}
        flags={flags}
      />
      <ReviewPanel
        key={`${call.id}:${existing?.reviewedAt ?? ""}`}
        callId={call.id}
        existing={existing}
        flaggedIssues={flaggedIssues}
        onShowIssues={showFirstIssue}
      >
        <SummarySentences
          analysis={analysis}
          selected={selected}
          onSelect={selectSentence}
          onShowTurn={showTurn}
        />
      </ReviewPanel>
    </div>
  )
}
