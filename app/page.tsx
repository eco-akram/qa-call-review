import { CircleCheck } from "lucide-react"

import { CallSidebar } from "@/components/call-sidebar"
import { CallWorkspace } from "@/components/call-workspace"
import { DeleteCallButton } from "@/components/delete-call-button"
import { ImportCalls } from "@/components/import-calls"
import { analyseCall } from "@/lib/analysis"
import { countReviews, latestReviews, listCalls } from "@/lib/data"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** Confirmation shown after a delete redirects back here. */
function DeletedNotice({ callId, reviews }: { callId: string; reviews: number }) {
  return (
    <p
      role="status"
      className="flex items-center gap-1.5 border-b border-emerald-600/40 bg-emerald-50 px-5 py-2 text-sm text-emerald-900 dark:bg-emerald-900/35 dark:text-emerald-100"
    >
      <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-mono font-semibold">{callId}</span> was deleted
        {reviews > 0 && ` along with ${reviews} review decision${reviews === 1 ? "" : "s"}`}.
      </span>
    </p>
  )
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const requestedId = first(params.call)
  const deletedId = first(params.deleted)
  const deletedReviews = Number(first(params.reviews) ?? 0) || 0
  const [calls, reviews] = await Promise.all([listCalls(), latestReviews()])

  if (calls.length === 0) {
    return (
      <div className="flex h-svh flex-col">
        {deletedId && <DeletedNotice callId={deletedId} reviews={deletedReviews} />}
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md space-y-2 text-sm">
            <h1 className="text-base font-semibold">No calls in the database</h1>
            <p className="text-muted-foreground">
              Import a JSON file of calls, or load the sample data by running{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                npm run db:setup
              </code>
              .
            </p>
            <ImportCalls />
          </div>
        </div>
      </div>
    )
  }

  // Default to the first unreviewed call, falling back to the first call.
  const call =
    calls.find((c) => c.id === requestedId) ??
    calls.find((c) => !reviews[c.id]) ??
    calls[0]
  const existing = reviews[call.id]
  const reviewCount = await countReviews(call.id)
  const issueCounts = Object.fromEntries(
    calls.map((c) => {
      const a = analyseCall(c)
      return [c.id, a.conflictCount + a.unsupportedCount]
    })
  )

  return (
    <div className="flex h-svh overflow-hidden">
      <CallSidebar
        calls={calls}
        reviews={reviews}
        issueCounts={issueCounts}
        activeId={call.id}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {deletedId && <DeletedNotice callId={deletedId} reviews={deletedReviews} />}
        <header className="flex items-center gap-3 border-b px-5 py-2.5">
          <h2 className="font-mono text-base font-semibold">{call.id}</h2>
          <span className="text-sm text-muted-foreground">
            {call.call_date} · ~{call.estimated_duration}
          </span>
          <DeleteCallButton key={call.id} callId={call.id} reviewCount={reviewCount} />
        </header>

        <CallWorkspace key={call.id} call={call} existing={existing} />
      </main>
    </div>
  )
}
