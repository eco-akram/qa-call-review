// Client-safe call types and helpers. Data access lives in lib/data.ts.

export type Call = {
  id: string
  call_date: string
  estimated_duration: string
  transcript: string
  summary: string
}

export type Turn = {
  id: string
  time: string
  speaker: string
  text: string
}

const TURN_RE = /^(T\d+)\s+\[(\d{1,2}:\d{2})\]\s+([^:]+):\s*(.*)$/

/** Splits "T01 [00:00] Agent: text" lines into structured turns. */
export function parseTranscript(transcript: string): Turn[] {
  return transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const m = line.match(TURN_RE)
      if (!m) return { id: `L${i + 1}`, time: "", speaker: "", text: line }
      return { id: m[1], time: m[2], speaker: m[3].trim(), text: m[4] }
    })
}
