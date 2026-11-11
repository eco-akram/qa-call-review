import { promises as fs } from "fs"
import path from "path"

import type { Review, ReviewMap } from "@/lib/review-types"

// Server-only: persists QA decisions to data/reviews.json.
const REVIEWS_PATH = path.join(process.cwd(), "data", "reviews.json")

export async function readReviews(): Promise<ReviewMap> {
  try {
    const raw = await fs.readFile(REVIEWS_PATH, "utf8")
    return JSON.parse(raw) as ReviewMap
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw err
  }
}

export async function writeReview(review: Review): Promise<void> {
  const reviews = await readReviews()
  reviews[review.callId] = review
  await fs.writeFile(
    REVIEWS_PATH,
    JSON.stringify(reviews, null, 2) + "\n",
    "utf8"
  )
}
