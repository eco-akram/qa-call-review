import { cn } from "@/lib/utils"
import { DECISION_LABELS, type Decision } from "@/lib/review-types"

export const DECISION_STYLES: Record<Decision, string> = {
  approve:
    "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-400",
  reject: "bg-red-500/10 text-red-700 ring-red-600/20 dark:text-red-400",
  needs_edit:
    "bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:text-amber-400",
}

export function StatusBadge({
  decision,
  className,
}: {
  decision: Decision | undefined
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        decision
          ? DECISION_STYLES[decision]
          : "bg-muted text-muted-foreground ring-border",
        className
      )}
    >
      {decision ? DECISION_LABELS[decision] : "Pending"}
    </span>
  )
}
