import { CallSidebar } from "@/components/call-sidebar"
import { ReviewPanel } from "@/components/review-panel"
import { TranscriptPanel } from "@/components/transcript-panel"
import { calls, getCall, parseTranscript } from "@/lib/calls"
import { readReviews } from "@/lib/reviews"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ call?: string | string[] }>
}) {
  const { call: callParam } = await searchParams
  const requestedId = Array.isArray(callParam) ? callParam[0] : callParam
  const reviews = await readReviews()

  // Default to the first unreviewed call, falling back to the first call.
  const call =
    getCall(requestedId) ?? calls.find((c) => !reviews[c.id]) ?? calls[0]
  const existing = reviews[call.id]

  return (
    <div className="flex h-svh overflow-hidden">
      <CallSidebar calls={calls} reviews={reviews} activeId={call.id} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-baseline gap-3 border-b px-5 py-3">
          <h2 className="font-mono text-base font-semibold">{call.id}</h2>
          <span className="text-sm text-muted-foreground">
            {call.call_date} · ~{call.estimated_duration}
          </span>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-2">
          <TranscriptPanel turns={parseTranscript(call.transcript)} />
          <ReviewPanel
            key={`${call.id}:${existing?.reviewedAt ?? ""}`}
            callId={call.id}
            summary={call.summary}
            existing={existing}
          />
        </div>
      </main>
    </div>
  )
}
