"use client"

import { Check, PencilLine, X } from "lucide-react"
import { useActionState, useState } from "react"

import { saveReview, type SaveReviewState } from "@/app/actions"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  REASON_MAX,
  type Decision,
  type Review,
} from "@/lib/review-types"
import { cn } from "@/lib/utils"

const OPTIONS: {
  value: Decision
  label: string
  icon: typeof Check
  selected: string
}[] = [
  {
    value: "approve",
    label: "Approve",
    icon: Check,
    selected:
      "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600/90",
  },
  {
    value: "reject",
    label: "Reject",
    icon: X,
    selected: "border-red-600 bg-red-600 text-white hover:bg-red-600/90",
  },
  {
    value: "needs_edit",
    label: "Needs edit",
    icon: PencilLine,
    selected: "border-amber-500 bg-amber-500 text-white hover:bg-amber-500/90",
  },
]

export function ReviewPanel({
  callId,
  summary,
  existing,
}: {
  callId: string
  summary: string
  existing: Review | undefined
}) {
  const [decision, setDecision] = useState<Decision | null>(
    existing?.decision ?? null
  )
  const [reason, setReason] = useState(existing?.reason ?? "")
  const [state, formAction, pending] = useActionState<SaveReviewState, FormData>(
    saveReview,
    { ok: false }
  )

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

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
      </div>

      <form action={formAction} className="space-y-3 border-t bg-muted/30 p-4">
        <input type="hidden" name="callId" value={callId} />
        <input type="hidden" name="decision" value={decision ?? ""} />

        <div
          role="radiogroup"
          aria-label="Decision"
          className="grid grid-cols-3 gap-2"
        >
          {OPTIONS.map(({ value, label, icon: Icon, selected }) => {
            const isSelected = decision === value
            return (
              <Button
                key={value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                variant="outline"
                size="lg"
                onClick={() => setDecision(value)}
                className={cn(isSelected && selected)}
              >
                <Icon />
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
            placeholder="e.g. T08: summary says customer called in, but call was outbound (T01)"
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p
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
          <Button type="submit" disabled={!canSave || !dirty || pending}>
            {pending ? "Saving…" : existing ? "Update review" : "Save review"}
          </Button>
        </div>
      </form>
    </section>
  )
}
