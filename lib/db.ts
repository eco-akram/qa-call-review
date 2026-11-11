import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

// Server-only. Uses Neon's HTTP driver, which suits Vercel functions: no
// connection pool to manage, one HTTPS request per query.

let client: NeonQueryFunction<false, false> | undefined

export function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Add your Neon connection string to .env locally and to the Vercel project's environment variables."
      )
    }
    client = neon(url)
  }
  return client
}
