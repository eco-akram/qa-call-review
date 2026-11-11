import type { Turn } from "@/lib/calls"
import { cn } from "@/lib/utils"

export function TranscriptPanel({ turns }: { turns: Turn[] }) {
  return (
    <section className="flex min-h-0 flex-col" aria-labelledby="transcript-heading">
      <h2
        id="transcript-heading"
        className="border-b px-5 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Transcript
      </h2>
      <ol className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {turns.map((turn) => {
          const isAgent = turn.speaker.toLowerCase().startsWith("agent")
          return (
            <li
              key={turn.id}
              id={turn.id}
              className="grid scroll-mt-4 grid-cols-[3rem_1fr] gap-2 rounded-md px-2 py-1.5 text-sm leading-relaxed hover:bg-muted/60 target:bg-primary/10"
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
                {turn.text}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
