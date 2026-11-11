"use client"

import type { ReactNode } from "react"

import type { Turn } from "@/lib/calls"
import { tokenize, type TurnMatch } from "@/lib/matching"
import { cn } from "@/lib/utils"

/** A span of a turn's text that a summary fact conflicts with. */
export type TurnFlag = { start: number; end: number; label: string }

type Mark = "none" | "match" | "flag"

/**
 * Renders turn text with overlapping words (yellow) and conflicting
 * wording (red) marked up. Red wins where both apply.
 */
function renderMarked(text: string, matched: Set<string> | undefined, flags: TurnFlag[] | undefined): ReactNode[] {
  const marks: Mark[] = Array(text.length).fill("none")
  const titles: (string | undefined)[] = Array(text.length).fill(undefined)
  if (matched) {
    for (const tok of tokenize(text)) {
      if (tok.keys.some((k) => matched.has(k))) marks.fill("match", tok.start, tok.end)
    }
  }
  for (const f of flags ?? []) {
    marks.fill("flag", f.start, f.end)
    titles.fill(f.label, f.start, f.end)
  }

  const out: ReactNode[] = []
  let i = 0
  while (i < text.length) {
    let j = i
    while (j < text.length && marks[j] === marks[i] && titles[j] === titles[i]) j++
    const slice = text.slice(i, j)
    if (marks[i] === "none") out.push(slice)
    else
      out.push(
        <mark
          key={i}
          title={titles[i]}
          className={cn(
            "rounded-sm px-0.5 text-inherit",
            marks[i] === "flag"
              ? "bg-red-500/20 font-medium text-red-800 underline decoration-red-500 decoration-2 underline-offset-2 dark:text-red-300"
              : "bg-yellow-300/70 dark:bg-yellow-500/40"
          )}
        >
          {slice}
        </mark>
      )
    i = j
  }
  return out
}

export function TranscriptPanel({
  turns,
  matches,
  flags,
}: {
  turns: Turn[]
  matches: TurnMatch[] | null
  flags: Map<string, TurnFlag[]>
}) {
  const byTurn = new Map(matches?.map((m) => [m.turnId, m]))

  return (
    <section className="flex min-h-0 flex-col" aria-labelledby="transcript-heading">
      <h2
        id="transcript-heading"
        className="flex items-center justify-between border-b px-5 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Transcript
        {matches && (
          <span className="font-normal tracking-normal normal-case">
            {matches.length} matching turn{matches.length === 1 ? "" : "s"}
            {flags.size > 0 && (
              <span className="text-red-700 dark:text-red-400">
                {" "}· {flags.size} conflicting
              </span>
            )}
          </span>
        )}
      </h2>
      <ol className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {turns.map((turn) => {
          const isAgent = turn.speaker.toLowerCase().startsWith("agent")
          const match = byTurn.get(turn.id)
          const turnFlags = flags.get(turn.id)
          return (
            <li
              key={turn.id}
              id={turn.id}
              className={cn(
                "grid scroll-mt-4 grid-cols-[3rem_1fr] gap-2 rounded-md border-l-2 border-transparent px-2 py-1.5 text-sm leading-relaxed transition-colors hover:bg-muted/60 target:bg-primary/10",
                match &&
                  (match.strength >= 0.75
                    ? "border-yellow-500 bg-yellow-400/20 hover:bg-yellow-400/25"
                    : "border-yellow-500/50 bg-yellow-400/10 hover:bg-yellow-400/15"),
                turnFlags && "border-red-500 bg-red-500/10 hover:bg-red-500/15",
                matches && !match && !turnFlags && "opacity-60"
              )}
            >
              <span className="pt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                {turn.id}
                {turn.time && <span className="block">{turn.time}</span>}
              </span>
              <p>
                {turn.speaker && (
                  <span
                    className={cn(
                      "mr-1.5 font-semibold",
                      isAgent ? "text-primary" : "text-foreground"
                    )}
                  >
                    {turn.speaker}:
                  </span>
                )}
                {match || turnFlags
                  ? renderMarked(turn.text, match?.matched, turnFlags)
                  : turn.text}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
