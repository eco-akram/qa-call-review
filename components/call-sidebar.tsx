import Link from "next/link"

import { StatusBadge } from "@/components/status-badge"
import type { Call } from "@/lib/calls"
import type { ReviewMap } from "@/lib/review-types"
import { cn } from "@/lib/utils"

export function CallSidebar({
  calls,
  reviews,
  activeId,
}: {
  calls: Call[]
  reviews: ReviewMap
  activeId: string
}) {
  const reviewed = calls.filter((c) => reviews[c.id]).length

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="border-b px-4 py-3">
        <h1 className="text-sm font-semibold">Call summary QA</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {reviewed} of {calls.length} reviewed
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(reviewed / calls.length) * 100}%` }}
          />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Calls">
        <ul className="flex flex-col gap-0.5">
          {calls.map((call) => {
            const active = call.id === activeId
            return (
              <li key={call.id}>
                <Link
                  href={`/?call=${call.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                    active &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-mono text-[13px]">{call.id}</span>
                    <span className="text-xs text-muted-foreground">
                      {call.call_date} · {call.estimated_duration}
                    </span>
                  </span>
                  <StatusBadge decision={reviews[call.id]?.decision} />
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
