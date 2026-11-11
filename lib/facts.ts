/**
 * Fact-level consistency checking between a summary and its transcript.
 *
 * Transcripts say "the twenty-third of October", "after half five" or
 * "two hundred and twenty pounds"; summaries say "23 October", "5.30 pm" and
 * "£220". We normalise spoken numbers to digits, extract typed facts (money,
 * dates, times, durations) from both sides and compare canonical keys.
 *
 * A summary fact is:
 *   - supported   if the transcript states the same value;
 *   - conflicting if the transcript states other values of the same kind
 *                 (e.g. summary "14 October", transcript "4th of October");
 *   - unsupported if the transcript states nothing of that kind.
 * Pure and client-safe.
 */

import type { Turn } from "@/lib/calls"

// ---------------------------------------------------------------------------
// Spoken numbers -> digits

type NumKind = "unit" | "teen" | "tens" | "scale"
type NumWord = { value: number; kind: NumKind; ordinal: boolean }

const NUMBER_WORDS: Record<string, NumWord> = {}
function addNumbers(words: string, kind: NumKind, ordinal: boolean, values: number[]) {
  words.split(" ").forEach((w, i) => (NUMBER_WORDS[w] = { value: values[i], kind, ordinal }))
}
addNumbers("one two three four five six seven eight nine", "unit", false, [1, 2, 3, 4, 5, 6, 7, 8, 9])
addNumbers("first second third fourth fifth sixth seventh eighth ninth", "unit", true, [1, 2, 3, 4, 5, 6, 7, 8, 9])
addNumbers(
  "ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen",
  "teen", false, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
)
addNumbers(
  "tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth",
  "teen", true, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
)
addNumbers("twenty thirty forty fifty sixty seventy eighty ninety", "tens", false, [20, 30, 40, 50, 60, 70, 80, 90])
addNumbers("twentieth thirtieth", "tens", true, [20, 30])
addNumbers("hundred thousand", "scale", false, [100, 1000])

/** Whether word kind `next` can continue a spoken number ending in `prev`. */
function continues(prev: NumKind, next: NumKind): boolean {
  if (prev === "tens") return next === "unit" || next === "scale"
  if (prev === "scale") return next !== "scale"
  return next === "scale"
}

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th"
  return ["th", "st", "nd", "rd"][n % 10] ?? "th"
}

type Chunk = { outStart: number; outEnd: number; origStart: number; origEnd: number; verbatim: boolean }

export type Normalised = {
  text: string
  /** Maps a [start, end) range in `text` back to the original string. */
  toOriginal: (start: number, end: number) => [number, number]
}

/** Rewrites spoken numbers as digits: "the twenty-third" -> "the 23rd". */
export function normaliseNumbers(src: string): Normalised {
  const words = [...src.matchAll(/[A-Za-z]+(?:-[A-Za-z]+)*/g)].map((m) => ({
    text: m[0],
    start: m.index!,
    end: m.index! + m[0].length,
  }))

  const chunks: Chunk[] = []
  let out = ""
  let pos = 0
  const emit = (origStart: number, origEnd: number, replacement?: string) => {
    if (origStart > pos) {
      chunks.push({ outStart: out.length, outEnd: out.length + origStart - pos, origStart: pos, origEnd: origStart, verbatim: true })
      out += src.slice(pos, origStart)
    }
    const str = replacement ?? src.slice(origStart, origEnd)
    chunks.push({ outStart: out.length, outEnd: out.length + str.length, origStart, origEnd, verbatim: replacement === undefined })
    out += str
    pos = origEnd
  }

  for (let i = 0; i < words.length; i++) {
    const parts = words[i].text.toLowerCase().split("-")
    let lead = 0
    while (lead < parts.length && NUMBER_WORDS[parts[lead]]) lead++
    if (lead === 0) continue

    // Parse a run of number words, possibly across several words / "and".
    let total = 0
    let current = 0
    let prev: NumKind | null = null
    let ordinal = false
    let endWord = i
    let ok = true
    const consume = (w: string) => {
      const n = NUMBER_WORDS[w]
      if (!n || ordinal || (prev && !continues(prev, n.kind))) return false
      if (n.value === 100) current = (current || 1) * 100
      else if (n.value === 1000) {
        total += (current || 1) * 1000
        current = 0
      } else current += n.value
      prev = n.kind
      ordinal = n.ordinal
      return true
    }
    for (let p = 0; p < lead; p++) if (!consume(parts[p])) ok = false
    if (!ok) continue

    if (lead === parts.length) {
      // Whole word is numeric; try to extend across following words.
      let j = i + 1
      while (j < words.length && !ordinal) {
        const gap = src.slice(words[j - 1].end, words[j].start)
        if (!/^\s+$/.test(gap)) break
        const w = words[j].text.toLowerCase()
        if (w === "and" && prev === "scale" && j + 1 < words.length) {
          const nextParts = words[j + 1].text.toLowerCase().split("-")
          if (nextParts.every((p) => NUMBER_WORDS[p]) && NUMBER_WORDS[nextParts[0]].kind !== "scale") {
            j++
            continue
          }
          break
        }
        const nextParts = w.split("-")
        if (!nextParts.every((p) => NUMBER_WORDS[p])) break
        const save = { total, current, prev, ordinal }
        if (!nextParts.every(consume)) {
          ;({ total, current, prev, ordinal } = save)
          break
        }
        endWord = j
        j++
      }
      const value = total + current
      emit(words[i].start, words[endWord].end, ordinal ? `${value}${ordinalSuffix(value)}` : String(value))
      i = endWord
    } else {
      // e.g. "seven-day" -> "7-day", "fifty-pound" -> "50-pound"
      const value = total + current
      const rest = words[i].text.split("-").slice(lead).join("-")
      emit(words[i].start, words[i].end, `${ordinal ? value + ordinalSuffix(value) : value}-${rest}`)
    }
  }
  emit(src.length, src.length)

  const toOriginal = (start: number, end: number): [number, number] => {
    const find = (o: number) => chunks.find((c) => o >= c.outStart && o < c.outEnd) ?? chunks[chunks.length - 1]
    const a = find(start)
    const b = find(Math.max(start, end - 1))
    const s = a.verbatim ? a.origStart + (start - a.outStart) : a.origStart
    const e = b.verbatim ? b.origStart + (end - b.outStart) : b.origEnd
    return [s, e]
  }
  return { text: out, toOriginal }
}

// ---------------------------------------------------------------------------
// Fact extraction

export type FactType = "money" | "date" | "time" | "duration"

export type Fact = {
  type: FactType
  /** Canonical comparison key, e.g. "220", "2026-10-23", "5:30", "7 day". */
  key: string
  /** Human-readable value, e.g. "£220", "23 October", "5:30", "7 days". */
  value: string
  /** Offsets of the phrase in the original (un-normalised) text. */
  start: number
  end: number
  /** Original wording, e.g. "the twenty-third of October". */
  quote: string
  turnId?: string
  /** Bare numbers ("Sixty on Friday") that may be amounts: support only. */
  weak?: boolean
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
]
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const MONTH_RE = MONTHS.join("|")
const WEEKDAY_RE = WEEKDAYS.join("|")
const ORD = "(?:st|nd|rd|th)"

// "the Nth" is only a date when followed by punctuation, the end of the text,
// or a connecting word ("the fourth of December", "the eighth falls on",
// "from the twenty-fifth to"). Followed by a noun it is an ordinal: "the first
// line", "the second agent", "the first collection". Derived from the words
// that follow day ordinals across the sample data.
const DATE_FOLLOWERS =
  "of|to|is|isn't|was|after|before|at|by|through|with|this|that|once|now|instead|falls|fell|would|will|works|suits|and|or|then|so|if|when|as|for|give|please"
const DAY_ORDINAL_END = `(?=\\s*(?:[.,;:!?)]|$)|'s\\b|\\s+(?:${DATE_FOLLOWERS})\\b)`

const MONTH_LABEL = (m: number) => MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1)

function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

type DateCtx = { callDate: Date }

/** A day of month without a month: the next such day on or after the call. */
function resolveDay(day: number, ctx: DateCtx): Date {
  const c = ctx.callDate
  let y = c.getUTCFullYear()
  let m = c.getUTCMonth()
  if (day < c.getUTCDate()) m += 1
  if (m > 11) {
    m = 0
    y++
  }
  return new Date(Date.UTC(y, m, day))
}

function resolveMonthDay(day: number, month: number, ctx: DateCtx): Date {
  const c = ctx.callDate
  // Dates more than ~2 months before the call are taken as next year.
  let y = c.getUTCFullYear()
  if (month < c.getUTCMonth() - 2) y++
  return new Date(Date.UTC(y, month, day))
}

function resolveWeekday(name: string, ctx: DateCtx): Date {
  const target = WEEKDAYS.indexOf(name)
  const c = ctx.callDate
  let delta = (target - c.getUTCDay() + 7) % 7
  if (delta === 0) delta = 7
  return new Date(c.getTime() + delta * 86_400_000)
}

function dateFact(d: Date, base: Omit<Fact, "type" | "key" | "value">): Fact {
  return { ...base, type: "date", key: isoDate(d), value: `${d.getUTCDate()} ${MONTH_LABEL(d.getUTCMonth())}` }
}

/** Extracts money, date, time and duration facts from a piece of text. */
export function extractFacts(src: string, ctx: DateCtx, turnId?: string): Fact[] {
  const norm = normaliseNumbers(src)
  const text = norm.text
  const facts: Fact[] = []
  const taken: [number, number][] = []
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a)

  const scan = (re: RegExp, build: (m: RegExpMatchArray, base: Omit<Fact, "type" | "key" | "value">) => Fact | null) => {
    for (const m of text.matchAll(re)) {
      const s = m.index!
      const e = s + m[0].length
      if (overlaps(s, e)) continue
      const [os, oe] = norm.toOriginal(s, e)
      const fact = build(m, { start: os, end: oe, quote: src.slice(os, oe), turnId })
      if (fact) {
        facts.push(fact)
        taken.push([s, e])
      }
    }
  }

  // --- Dates -------------------------------------------------------------
  scan(new RegExp(`\\b(?:(?:${WEEKDAY_RE}),?\\s+)?(?:the\\s+)?(\\d{1,2})${ORD}?(?:\\s+of)?\\s+(${MONTH_RE})\\b`, "gi"), (m, b) => {
    const day = +m[1]
    return day >= 1 && day <= 31 ? dateFact(resolveMonthDay(day, MONTHS.indexOf(m[2].toLowerCase()), ctx), b) : null
  })
  scan(new RegExp(`\\b(${MONTH_RE})\\s+(?:the\\s+)?(\\d{1,2})${ORD}?\\b`, "gi"), (m, b) => {
    const day = +m[2]
    return day >= 1 && day <= 31 ? dateFact(resolveMonthDay(day, MONTHS.indexOf(m[1].toLowerCase()), ctx), b) : null
  })
  scan(new RegExp(`\\b(?:${WEEKDAY_RE})\\s+the\\s+(\\d{1,2})${ORD}\\b`, "gi"), (m, b) => {
    const day = +m[1]
    return day >= 1 && day <= 31 ? dateFact(resolveDay(day, ctx), b) : null
  })
  scan(new RegExp(`\\bthe\\s+(\\d{1,2})${ORD}\\b(?!-)${DAY_ORDINAL_END}`, "gi"), (m, b) => {
    const day = +m[1]
    return day >= 1 && day <= 31 ? dateFact(resolveDay(day, ctx), b) : null
  })
  scan(new RegExp(`\\b(last\\s+|the\\s+)?(${WEEKDAY_RE})\\b`, "gi"), (m, b) =>
    m[1] ? null : dateFact(resolveWeekday(m[2].toLowerCase(), ctx), b)
  )
  scan(/\b(tomorrow|today)\b/gi, (m, b) =>
    dateFact(new Date(ctx.callDate.getTime() + (m[1].toLowerCase() === "tomorrow" ? 86_400_000 : 0)), b)
  )

  // --- Times -------------------------------------------------------------
  const timeFact = (h: number, min: number, b: Omit<Fact, "type" | "key" | "value">): Fact | null =>
    h >= 1 && h <= 23 && min < 60
      ? { ...b, type: "time", key: `${h % 12 || 12}:${String(min).padStart(2, "0")}`, value: `${h % 12 || 12}:${String(min).padStart(2, "0")}` }
      : null
  scan(/\b(\d{1,2})(?:[.:](\d{2}))?\s*(?:am|pm|a\.m\.|p\.m\.|o'clock)/gi, (m, b) => timeFact(+m[1], +(m[2] ?? 0), b))
  scan(/\bhalf\s+(?:past\s+)?(\d{1,2})\b/gi, (m, b) => timeFact(+m[1], 30, b))
  scan(/\b(\d{1,2})(?:[.:](\d{2}))?\s+in\s+the\s+(?:morning|afternoon|evening)\b/gi, (m, b) => timeFact(+m[1], +(m[2] ?? 0), b))
  scan(
    /\b(?:after|before|from|around|about|at|by)\s+(\d{1,2})(?:[.:](\d{2}))?\b(?![-.,]?\d)(?!\s*(?:-|day|days|week|weeks|month|months|year|years|minute|minutes|second|seconds|missed|instalments?|payments?|pounds?|quid|%|st|nd|rd|th|of))/gi,
    (m, b) => timeFact(+m[1], +(m[2] ?? 0), b)
  )

  // --- Durations ---------------------------------------------------------
  scan(/\b(\d+)[-\s]+(working[-\s]+)?(day|week|month)s?\b/gi, (m, b) => {
    const unit = `${m[2] ? "working " : ""}${m[3].toLowerCase()}`
    return { ...b, type: "duration", key: `${m[1]} ${unit}`, value: `${m[1]} ${unit}${+m[1] === 1 ? "" : "s"}` }
  })

  // --- Money -------------------------------------------------------------
  const moneyFact = (raw: string, b: Omit<Fact, "type" | "key" | "value">, weak = false): Fact => {
    const n = String(+raw.replace(/,/g, ""))
    return { ...b, type: "money", key: n, value: `£${n}`, weak }
  }
  scan(/£\s?(\d[\d,]*(?:\.\d{2})?)/g, (m, b) => moneyFact(m[1], b))
  scan(/\b(\d[\d,]*)[-\s]?(?:pounds?|quid)\b/gi, (m, b) => moneyFact(m[1], b))
  // Bare numbers ("Sixty on Friday") can back up a summary amount.
  scan(/\b(\d[\d,]*)\b(?![.:]\d)/g, (m, b) => (+m[1].replace(/,/g, "") >= 5 ? moneyFact(m[1], b, true) : null))

  return facts.sort((a, b) => a.start - b.start)
}

// ---------------------------------------------------------------------------
// Comparison

export type IssueKind = "conflict" | "unsupported"

export type FactIssue = {
  kind: IssueKind
  fact: Fact
  /** Closest transcript facts of the same type (for conflicts). */
  candidates: Fact[]
}

const TYPE_LABEL: Record<FactType, string> = {
  money: "amount",
  date: "date",
  time: "time",
  duration: "duration",
}
export const factTypeLabel = (t: FactType) => TYPE_LABEL[t]

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

/** How plausible it is that transcript fact `t` is what summary fact `s` misstates. */
function closeness(s: Fact, t: Fact, evidence: Set<string>): number {
  let score = t.turnId && evidence.has(t.turnId) ? 3 : 0
  if (s.type === "date") {
    const [, sm, sd] = s.key.split("-")
    const [, tm, td] = t.key.split("-")
    if (sm === tm) score += 1
    score += Math.max(0, 2 - editDistance(String(+sd), String(+td)))
  } else {
    score += Math.max(0, 2 - editDistance(s.key, t.key))
  }
  return score
}

export function checkFacts(
  summaryFacts: Fact[],
  transcriptFacts: Fact[],
  evidenceTurnIds: Iterable<string> = []
): FactIssue[] {
  const evidence = new Set(evidenceTurnIds)
  const issues: FactIssue[] = []
  for (const fact of summaryFacts) {
    if (fact.weak) continue
    const sameType = transcriptFacts.filter((t) => t.type === fact.type)
    if (sameType.some((t) => t.key === fact.key)) continue

    const strong = sameType.filter((t) => !t.weak)
    if (!strong.length) {
      issues.push({ kind: "unsupported", fact, candidates: [] })
      continue
    }
    const seen = new Set<string>()
    const candidates = [...strong]
      .sort((a, b) => closeness(fact, b, evidence) - closeness(fact, a, evidence))
      .filter((t) => (seen.has(t.key) ? false : (seen.add(t.key), true)))
      .slice(0, 2)
    issues.push({ kind: "conflict", fact, candidates })
  }
  return issues
}

export function extractTranscriptFacts(turns: Turn[], callDate: string): Fact[] {
  const ctx = { callDate: new Date(`${callDate}T00:00:00Z`) }
  return turns.flatMap((t) => extractFacts(t.text, ctx, t.id))
}

export function extractSummaryFacts(sentence: string, callDate: string): Fact[] {
  return extractFacts(sentence, { callDate: new Date(`${callDate}T00:00:00Z`) })
}
