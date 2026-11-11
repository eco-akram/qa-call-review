"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { ReviewPanel } from "@/components/review-panel"
import { SummarySentences } from "@/components/summary-sentences"
import { TranscriptPanel, type TurnFlag } from "@/components/transcript-panel"
import type { Call } from "@/lib/calls"
import { analyseCall } from "@/lib/analysis"
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
