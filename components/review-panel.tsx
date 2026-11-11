"use client"

import { Check, PencilLine, TriangleAlert, X } from "lucide-react"
import { useActionState, useEffect, useRef, useState } from "react"

import { saveReview, type SaveReviewState } from "@/app/actions"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  REASON_MAX,
  type Decision,
  type Review,
} from "@/lib/review-types"
import { cn } from "@/lib/utils"

// Colours are chosen for WCAG AA in both themes (measured against Tailwind's
// palette): text ≥ 4.5:1 on its background, borders ≥ 3:1 against the page.
//   idle      light: 800/900 text on 50 tint (≥7.2:1), 600 border (≥3.2:1)
//             dark:  200 text on 900/35 tint (≥11.9:1), 500 border (≥5.2:1)
//   selected  white on 700 fill (≥5.0:1), plus an offset ring so the state
//             is not conveyed by colour alone.
const OPTIONS: {
  value: Decision
  label: string
  icon: typeof Check
  idle: string
  selected: string
  /** Keeps the coloured border on focus (the base button greys it out). */
  focusBorder: string
}[] = [
  {
    value: "approve",
    label: "Approve",
    icon: Check,
    idle: "border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-500 dark:bg-emerald-900/35 dark:text-emerald-200 dark:hover:bg-emerald-900/60",
    selected:
      "border-emerald-700 bg-emerald-700 text-white ring-emerald-700 hover:bg-emerald-800 hover:text-white dark:border-emerald-700 dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-800",
    focusBorder: "focus-visible:border-emerald-700",
  },
  {
    value: "reject",
    label: "Reject",
    icon: X,
    idle: "border-red-600 bg-red-50 text-red-800 hover:bg-red-100 hover:text-red-800 dark:border-red-500 dark:bg-red-900/35 dark:text-red-200 dark:hover:bg-red-900/60",
    selected:
      "border-red-700 bg-red-700 text-white ring-red-700 hover:bg-red-800 hover:text-white dark:border-red-700 dark:bg-red-700 dark:text-white dark:hover:bg-red-800",
    focusBorder: "focus-visible:border-red-700",
  },
  {
    value: "needs_edit",
    label: "Needs edit",
    icon: PencilLine,
    idle: "border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-500 dark:bg-amber-900/35 dark:text-amber-200 dark:hover:bg-amber-900/60",
    selected:
      "border-amber-700 bg-amber-700 text-white ring-amber-700 hover:bg-amber-800 hover:text-white dark:border-amber-700 dark:bg-amber-700 dark:text-white dark:hover:bg-amber-800",
    focusBorder: "focus-visible:border-amber-700",
  },
]

const NAV_KEYS: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
}

export function ReviewPanel({
  callId,
  existing,
  flaggedIssues = [],
  onShowIssues,
  children,
}: {
  callId: string
  existing: Review | undefined
  /** Short descriptions of automatically flagged facts in the summary. */
  flaggedIssues?: string[]
  /** Jumps to the first flagged sentence. */
  onShowIssues?: () => void
  /** The summary content shown above the decision form. */
  children: React.ReactNode
}) {
  const [decision, setDecision] = useState<Decision | null>(
    existing?.decision ?? null
  )
  const [reason, setReason] = useState(existing?.reason ?? "")
  const [state, formAction, pending] = useActionState<SaveReviewState, FormData>(
    saveReview,
    { ok: false }
  )

  // "Approve anyway?" guard: shown when approving a summary with flagged facts.
  const [guardOpen, setGuardOpen] = useState(false)
  const needsGuard = decision === "approve" && flaggedIssues.length > 0
  const approveAnywayRef = useRef<HTMLButtonElement>(null)
  const saveRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (guardOpen) approveAnywayRef.current?.focus()
  }, [guardOpen])
  const closeGuard = () => {
    setGuardOpen(false)
    // Return focus to where the reviewer was once the Save button re-renders.
    requestAnimationFrame(() => saveRef.current?.focus())
  }

  const reasonRequired = decision !== null && decision !== "approve"
  const canSave =
    decision !== null && (!reasonRequired || reason.trim().length > 0)
  const dirty =
    decision !== (existing?.decision ?? null) ||
    reason.trim() !== (existing?.reason ?? "")

  return (
    <section
      className="flex min-h-0 flex-col border-l"
      aria-labelledby="summary-heading"
    >
      <div className="flex items-center justify-between border-b px-5 py-2.5">
        <h2
          id="summary-heading"
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          AI summary
        </h2>
        <StatusBadge decision={existing?.decision} />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">{children}</div>

      <form
        action={formAction}
        onSubmit={(e) => {
          if (needsGuard && !guardOpen) {
            e.preventDefault()
            setGuardOpen(true)
          }
        }}
        className="space-y-3 border-t bg-muted/30 p-4"
      >
        <input type="hidden" name="callId" value={callId} />
        <input type="hidden" name="decision" value={decision ?? ""} />

        {/* WAI-ARIA radio group: one Tab stop, arrow keys move and select. */}
        <div
          role="radiogroup"
          aria-label="Decision"
          aria-required="true"
          className="grid grid-cols-3 gap-2"
          onKeyDown={(e) => {
            const nav = NAV_KEYS[e.key]
            if (!nav) return
            e.preventDefault()
            const current = OPTIONS.findIndex((o) => o.value === decision)
            const next = nav(Math.max(current, 0), OPTIONS.length)
            setDecision(OPTIONS[next].value)
            setGuardOpen(false)
            e.currentTarget
              .querySelectorAll<HTMLElement>('[role="radio"]')
              [next]?.focus()
          }}
        >
          {OPTIONS.map(({ value, label, icon: Icon, idle, selected, focusBorder }, i) => {
            const isSelected = decision === value
            const isTabStop = decision === null ? i === 0 : isSelected
            return (
              <Button
                key={value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isTabStop ? 0 : -1}
                variant="outline"
                size="lg"
                onClick={() => {
                  setDecision(value)
                  setGuardOpen(false)
                }}
                className={cn(
                  "border-2 font-semibold",
                  isSelected
                    ? cn(selected, "ring-2 ring-offset-2 ring-offset-background")
                    : idle,
                  // High-contrast focus ring (the default one is 50% grey).
                  "focus-visible:ring-3 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  focusBorder
                )}
              >
                <Icon aria-hidden="true" />
                {label}
              </Button>
            )
          })}
        </div>

        <div className="space-y-1">
          <label
            htmlFor="reason"
            className="flex items-baseline justify-between text-xs font-medium"
          >
            <span>
              Reason{" "}
              <span className="font-normal text-muted-foreground">
                {reasonRequired ? "(required)" : "(optional)"}
              </span>
            </span>
            <span className="font-normal text-muted-foreground tabular-nums">
              {reason.length}/{REASON_MAX}
            </span>
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={2}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-required={reasonRequired}
            aria-invalid={state.error ? true : undefined}
            aria-describedby="review-status"
            placeholder="e.g. T08: summary says customer called in, but call was outbound (T01)"
            className="w-full resize-none rounded-lg border border-muted-foreground bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-foreground/25 aria-invalid:border-destructive"
          />
        </div>

        {guardOpen && (
          <div
            role="alertdialog"
            aria-labelledby="approve-guard-title"
            aria-describedby="approve-guard-list"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault()
                closeGuard()
              }
            }}
            className="rounded-lg border-2 border-amber-600 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500 dark:bg-amber-900/35 dark:text-amber-50"
          >
            <p id="approve-guard-title" className="flex items-start gap-2 font-semibold">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              This summary has {flaggedIssues.length} flagged issue
              {flaggedIssues.length === 1 ? "" : "s"}. Approve anyway?
            </p>
            <ul id="approve-guard-list" className="mt-1.5 ml-6 list-disc space-y-0.5 text-xs">
              {flaggedIssues.slice(0, 3).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
              {flaggedIssues.length > 3 && <li>…and {flaggedIssues.length - 3} more</li>}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                ref={approveAnywayRef}
                type="submit"
                disabled={pending}
                className="bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-3 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Check aria-hidden="true" />
                {pending ? "Saving…" : "Approve anyway"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={closeGuard}>
                Go back
              </Button>
              {onShowIssues && (
                <Button
                  type="button"
                  variant="link"
                  disabled={pending}
                  onClick={() => {
                    setGuardOpen(false)
                    onShowIssues()
                  }}
                  className="text-amber-950 underline dark:text-amber-50"
                >
                  Show issues
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p
            id="review-status"
            className={cn(
              "text-xs",
              state.error ? "text-destructive" : "text-muted-foreground"
            )}
            aria-live="polite"
          >
            {state.error
              ? state.error
              : existing
                ? `Saved ${new Date(existing.reviewedAt).toLocaleString("en-GB")}`
                : "Not yet reviewed"}
          </p>
          {!guardOpen && (
            <Button ref={saveRef} type="submit" disabled={!canSave || !dirty || pending}>
              {pending ? "Saving…" : existing ? "Update review" : "Save review"}
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}
