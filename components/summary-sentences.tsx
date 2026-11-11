"use client"

import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react"
import type { ReactNode } from "react"

import type { CallAnalysis } from "@/lib/analysis"
import { factTypeLabel, type FactIssue } from "@/lib/facts"
import { cn } from "@/lib/utils"

/** Sentence text with flagged facts underlined. */
function renderSentence(text: string, issues: FactIssue[]): ReactNode[] {
  const out: ReactNode[] = []
  let pos = 0
  for (const issue of [...issues].sort((a, b) => a.fact.start - b.fact.start)) {
    const { start, end } = issue.fact
    if (start < pos) continue
    out.push(text.slice(pos, start))
    out.push(
      <span
        key={start}
        className={cn(
          "rounded-sm px-0.5 font-medium underline decoration-wavy decoration-2 underline-offset-4",
          issue.kind === "conflict"
            ? "bg-red-500/15 text-red-800 decoration-red-500 dark:text-red-300"
            : "bg-amber-400/15 text-amber-800 decoration-amber-500 dark:text-amber-300"
        )}
      >
        {text.slice(start, end)}
      </span>
    )
    pos = end
  }
  out.push(text.slice(pos))
  return out
}

function TurnChip({
  turnId,
  tone,
  onClick,
}: {
  turnId: string
  tone: "red" | "yellow"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-inset",
        tone === "red"
          ? "bg-red-500/10 ring-red-600/30 hover:bg-red-500/25"
          : "bg-yellow-400/20 ring-yellow-600/30 hover:bg-yellow-400/40"
      )}
    >
      {turnId}
    </button>
  )
}

function IssueRow({
  issue,
  onShowTurn,
}: {
  issue: FactIssue
  onShowTurn: (turnId: string) => void
}) {
  const type = factTypeLabel(issue.fact.type)
  if (issue.kind === "unsupported") {
    return (
      <li className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
        <CircleHelp className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <strong className="font-semibold">Not in transcript:</strong> summary
          gives the {type} “{issue.fact.quote}”, but no {type} is mentioned in
          the call.
        </span>
      </li>
    )
  }
  return (
    <li className="flex items-start gap-1.5 text-red-800 dark:text-red-300">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span className="space-x-1">
        <strong className="font-semibold">Possible wrong {type}:</strong>
        <span>
          summary says “{issue.fact.quote}”, transcript says{" "}
        </span>
        {issue.candidates.map((c, i) => (
          <span key={`${c.turnId}-${c.start}`} className="inline-flex items-center gap-1">
            {i > 0 && <span>or</span>}
            <span>“{c.quote}”</span>
            {c.turnId && (
              <TurnChip turnId={c.turnId} tone="red" onClick={() => onShowTurn(c.turnId!)} />
            )}
          </span>
        ))}
      </span>
    </li>
  )
}

export function SummarySentences({
  analysis,
  selected,
  onSelect,
  onShowTurn,
}: {
  analysis: CallAnalysis
  selected: number | null
  onSelect: (index: number) => void
  onShowTurn: (sentence: number, turnId: string) => void
}) {
  const { sentences, conflictCount, unsupportedCount } = analysis
  const issueTotal = conflictCount + unsupportedCount

  return (
    <div className="space-y-3">
      {/* Overview */}
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
          conflictCount
            ? "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-200"
            : unsupportedCount
              ? "border-amber-500/40 bg-amber-400/10 text-amber-900 dark:text-amber-200"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
        )}
        role="status"
      >
        {issueTotal ? (
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
        ) : (
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
        )}
        <p>
          {issueTotal ? (
            <>
              <strong className="font-semibold">
                {[
                  conflictCount && `${conflictCount} possible inconsistenc${conflictCount === 1 ? "y" : "ies"}`,
                  unsupportedCount && `${unsupportedCount} unsupported fact${unsupportedCount === 1 ? "" : "s"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </strong>{" "}
              found in amounts, dates, times or durations. Flagged values are
              underlined below.
            </>
          ) : (
            <>
              <strong className="font-semibold">No inconsistencies found</strong>{" "}
              in amounts, dates, times or durations. Other claims still need
              checking by eye.
            </>
          )}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Click a sentence to highlight the transcript turns with the most word
        overlap. Esc clears.
      </p>

      <ol className="space-y-1">
        {sentences.map((s, i) => {
          const isSelected = selected === i
          const hasConflict = s.issues.some((x) => x.kind === "conflict")
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(i)}
                className={cn(
                  "grid w-full grid-cols-[2rem_1fr] gap-2 rounded-md border border-transparent px-2 py-2 text-left text-sm leading-relaxed transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                  hasConflict && "border-l-red-500",
                  isSelected && "border-yellow-500/50 bg-yellow-400/15 hover:bg-yellow-400/20"
                )}
              >
                <span
                  className={cn(
                    "pt-0.5 font-mono text-[11px] text-muted-foreground",
                    hasConflict && "font-semibold text-red-700 dark:text-red-400"
                  )}
                >
                  S{i + 1}
                </span>
                <span>{renderSentence(s.text, s.issues)}</span>
              </button>

              {(s.issues.length > 0 || s.missing.length > 0) && (
                <ul className="ml-10 space-y-1 px-2 pt-1 pb-2 text-xs">
                  {s.issues.map((issue) => (
                    <IssueRow
                      key={issue.fact.start}
                      issue={issue}
                      onShowTurn={(turnId) => onShowTurn(i, turnId)}
                    />
                  ))}
                  {s.missing.length > 0 && (
                    <li className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
                      <CircleHelp className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        <strong className="font-semibold">Name not in transcript:</strong>{" "}
                        {s.missing.join(", ")}
                      </span>
                    </li>
                  )}
                </ul>
              )}

              {isSelected && (
                <div className="ml-10 flex flex-wrap items-center gap-1.5 px-2 pb-2 text-xs">
                  <span className="text-muted-foreground">
                    {s.matches.length ? "Likely evidence:" : "No overlapping turns found."}
                  </span>
                  {s.matches.map((m) => (
                    <span key={m.turnId} title={`Shared words: ${[...m.matched].join(", ")}`}>
                      <TurnChip turnId={m.turnId} tone="yellow" onClick={() => onShowTurn(i, m.turnId)} />
                    </span>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
