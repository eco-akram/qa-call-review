/**
 * Word-overlap evidence matching between summary sentences and transcript
 * turns. Pure and client-safe.
 *
 * Pipeline: tokenise -> drop stopwords -> normalise (light stemming, spoken
 * numbers -> digits) -> score each turn against the sentence with BM25, so
 * words that are rare within the call count for more than common ones.
 */

import type { Turn } from "@/lib/calls"

// ---------------------------------------------------------------------------
// Sentences

/** Splits a summary into sentences on . ! ? followed by whitespace. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9£"“'‘(])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Tokens

export type Token = {
  start: number
  end: number
  /** Normalised match keys (empty if the token is a stopword). */
  keys: string[]
}

const STOPWORDS = new Set(
  `a about above after again against all am an and any are as at be because
  been before being below between both but by can could did do does doing don
  down during each few for from further had has have having he her here hers
  him his how i if in into is it its itself just me more most my no nor not
  now of off on once only or other our ours out over own same she should so
  some such than that the their theirs them then there these they this those
  through to too under until up very was we were what when where which while
  who whom why will with would you your yours yes yeah okay ok right please
  thank thanks well um uh oh also get got said say says one's i'm it's that's
  don't can't won't i've i'll i'd you're you've we'll we're there's let's
  customer agent been being much really`
    .split(/\s+/)
    .filter(Boolean)
)

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13,
  fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
  eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30,
}
const SCALES: Record<string, number> = {
  hundred: 100, hundredth: 100, thousand: 1000, thousandth: 1000,
}

const isNumberWord = (w: string) => w in UNITS || w in SCALES

/** "five hundred" -> 500, "twenty-third" -> 23, "one thousand two hundred" -> 1200 */
function parseNumberWords(words: string[]): number {
  let total = 0
  let current = 0
  for (const w of words) {
    if (w in UNITS) current += UNITS[w]
    else if (SCALES[w] === 100) current = (current || 1) * 100
    else if (SCALES[w] === 1000) {
      total += (current || 1) * 1000
      current = 0
    }
  }
  return total + current
}

/** Very light suffix stripping so "arranged" ≈ "arrangement" ≈ "arrange". */
function stem(w: string): string {
  if (w.length <= 4 || /\d/.test(w)) return w
  let s = w
  if (s.endsWith("ies")) s = s.slice(0, -3) + "y"
  else if (s.endsWith("ment") && s.length > 7) s = s.slice(0, -4)
  else if (s.endsWith("ing") && s.length > 5) s = s.slice(0, -3)
  else if (s.endsWith("ed") && s.length > 4) s = s.slice(0, -2)
  else if (s.endsWith("es") && s.length > 4) s = s.slice(0, -2)
  else if (s.endsWith("ly") && s.length > 4) s = s.slice(0, -2)
  else if (s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1)
  if (s.endsWith("e") && s.length > 4) s = s.slice(0, -1)
  return s
}

function normaliseWord(raw: string): string | null {
  const w = raw.toLowerCase().replace(/[’‘]/g, "'").replace(/'s$/, "")
  if (STOPWORDS.has(w) || w.length < 2) return null
  return stem(w)
}

/**
 * Summary-side vocabulary for terms the transcript usually expresses in other
 * words. Applied only to sentences, never to transcript turns.
 */
const ALIASES: Record<string, string[]> = {
  dpa: ["security", "birth", "postcode", "address"],
  "i&e": ["income", "expenditure"],
  signposted: ["website", "support"],
  signposting: ["website", "support"],
  moneyhelper: ["money", "helper"],
  stepchange: ["step", "change"],
  vulnerability: ["note", "record"],
}

const WORD_RE = /[£$]?\d+(?:[.,:]\d+)*|[A-Za-z]+(?:[&'’-][A-Za-z]+)*/g

/** Tokenises text, keeping character offsets so matches can be marked up. */
export function tokenize(text: string, { expandAliases = false } = {}): Token[] {
  const raw = [...text.matchAll(WORD_RE)].map((m) => ({
    word: m[0],
    start: m.index!,
    end: m.index! + m[0].length,
  }))

  const tokens: Token[] = []
  for (let i = 0; i < raw.length; i++) {
    const { word, start } = raw[i]
    const lower = word.toLowerCase()

    // Digits: "£500" -> "500", "1,200" -> "1200"
    if (/^[£$]?\d/.test(word)) {
      const n = word.replace(/^[£$]/, "").replace(/,(?=\d{3}\b)/g, "")
      tokens.push({ start, end: raw[i].end, keys: [n] })
      continue
    }

    // Spoken numbers, possibly spanning several words: "five hundred and twenty"
    const parts = lower.split("-")
    if (parts.every(isNumberWord)) {
      const words = [...parts]
      let j = i
      while (j + 1 < raw.length) {
        const next = raw[j + 1].word.toLowerCase().split("-")
        if (next.every(isNumberWord)) {
          words.push(...next)
          j++
        } else if (
          next[0] === "and" &&
          j + 2 < raw.length &&
          raw[j + 2].word.toLowerCase().split("-").every(isNumberWord)
        ) {
          j++
        } else break
      }
      tokens.push({
        start,
        end: raw[j].end,
        keys: [String(parseNumberWords(words))],
      })
      i = j
      continue
    }

    const keys = new Set<string>()
    const whole = normaliseWord(lower)
    if (whole) keys.add(whole)
    // Hyphenated words also match on their parts: "seven-day" -> 7, day
    if (parts.length > 1) {
      for (const p of parts) {
        const k = isNumberWord(p) ? String(parseNumberWords([p])) : normaliseWord(p)
        if (k) keys.add(k)
      }
    }
    if (expandAliases && ALIASES[lower]) {
      for (const a of ALIASES[lower]) keys.add(stem(a))
    }
    tokens.push({ start, end: raw[i].end, keys: [...keys] })
  }
  return tokens
}

// ---------------------------------------------------------------------------
// Scoring

export type TurnIndex = {
  turns: Turn[]
  tokens: Token[][]
  tf: Map<string, number>[]
  lengths: number[]
  avgLength: number
  df: Map<string, number>
}

export function buildIndex(turns: Turn[]): TurnIndex {
  const tokens = turns.map((t) => tokenize(t.text))
  const tf = tokens.map((toks) => {
    const m = new Map<string, number>()
    for (const tok of toks) for (const k of tok.keys) m.set(k, (m.get(k) ?? 0) + 1)
    return m
  })
  const lengths = tokens.map((toks) => toks.filter((t) => t.keys.length).length)
  const df = new Map<string, number>()
  for (const m of tf) for (const k of m.keys()) df.set(k, (df.get(k) ?? 0) + 1)
  const avgLength = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length)
  return { turns, tokens, tf, lengths, avgLength, df }
}

export type TurnMatch = {
  turnId: string
  score: number
  /** Score relative to the best match for this sentence, 0–1. */
  strength: number
  /** Keys shared between the sentence and this turn. */
  matched: Set<string>
}

export type SentenceMatch = {
  matches: TurnMatch[]
  queryKeys: Set<string>
  /**
   * Capitalised names in the sentence (as written) that appear in no
   * transcript turn: candidate unsupported facts.
   */
  missing: string[]
}

// Month/day names are routinely spoken differently ("the twenty-third"), so
// their absence is not a useful signal on its own.
const CALENDAR = new Set(
  `january february march april may june july august september october
  november december monday tuesday wednesday thursday friday saturday sunday`.split(/\s+/)
)

const K1 = 1.2
const B = 0.75

export type MatchOptions = {
  /** Keep turns scoring at least this fraction of the best turn. */
  relativeCutoff?: number
  maxResults?: number
}

export function matchSentence(
  index: TurnIndex,
  sentence: string,
  { relativeCutoff = 0.45, maxResults = 5 }: MatchOptions = {}
): SentenceMatch {
  const sentenceTokens = tokenize(sentence, { expandAliases: true })
  const queryKeys = new Set(sentenceTokens.flatMap((t) => t.keys))
  const N = index.turns.length

  // Capitalised names with no counterpart in the transcript. (Numbers, dates
  // and amounts are checked more precisely in lib/facts.ts.)
  const seen = new Set<string>()
  const missing: string[] = []
  for (const [i, tok] of sentenceTokens.entries()) {
    if (!tok.keys.length || tok.keys.some((k) => index.df.has(k))) continue
    const word = sentence.slice(tok.start, tok.end)
    const before = sentence.slice(0, tok.start).trimEnd()
    const isName =
      i > 0 &&
      /^[A-Z]/.test(word) &&
      !/[;:]$/.test(before) &&
      !CALENDAR.has(word.toLowerCase())
    if (!isName) continue
    if (!seen.has(word.toLowerCase())) {
      seen.add(word.toLowerCase())
      missing.push(word)
    }
  }

  const scored: TurnMatch[] = []
  index.turns.forEach((turn, i) => {
    let score = 0
    const matched = new Set<string>()
    for (const k of queryKeys) {
      const f = index.tf[i].get(k)
      if (!f) continue
      const df = index.df.get(k) ?? 0
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
      const norm = 1 - B + (B * index.lengths[i]) / (index.avgLength || 1)
      score += (idf * f * (K1 + 1)) / (f + K1 * norm)
      matched.add(k)
    }
    if (score > 0) scored.push({ turnId: turn.id, score, strength: 0, matched })
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]?.score ?? 0
  const matches = scored
    .filter((m) => m.score >= best * relativeCutoff)
    .slice(0, maxResults)
    .map((m) => ({ ...m, strength: best ? m.score / best : 0 }))

  return { matches, queryKeys, missing }
}
