export const DECISIONS = ["approve", "reject", "needs_edit"] as const
export type Decision = (typeof DECISIONS)[number]

export const DECISION_LABELS: Record<Decision, string> = {
  approve: "Approved",
  reject: "Rejected",
  needs_edit: "Needs edit",
}

export const REASON_MAX = 280

export type Review = {
  callId: string
  decision: Decision
  reason: string
  reviewedAt: string
}

export type ReviewMap = Record<string, Review>
