import { CallSidebar } from "@/components/call-sidebar"
import { CallWorkspace } from "@/components/call-workspace"
import { analyseCall } from "@/lib/analysis"
import { latestReviews, listCalls } from "@/lib/data"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ call?: string | string[] }>
}) {
  const { call: callParam } = await searchParams
  const requestedId = Array.isArray(callParam) ? callParam[0] : callParam
  const [calls, reviews] = await Promise.all([listCalls(), latestReviews()])

  if (calls.length === 0) {
    return (
      <div className="flex h-svh items-center justify-center p-6">
        <div className="max-w-md space-y-2 text-sm">
          <h1 className="text-base font-semibold">No calls in the database</h1>
          <p className="text-muted-foreground">
            Load the calls into Neon by running{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              npm run db:setup
            </code>{" "}
            with <code className="font-mono text-xs">DATABASE_URL</code> set.
          </p>
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
        <header className="flex items-baseline gap-3 border-b px-5 py-3">
          <h2 className="font-mono text-base font-semibold">{call.id}</h2>
          <span className="text-sm text-muted-foreground">
            {call.call_date} · ~{call.estimated_duration}
          </span>
        </header>

        <CallWorkspace key={call.id} call={call} existing={existing} />
      </main>
    </div>
  )
}
