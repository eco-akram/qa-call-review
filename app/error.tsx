"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-svh items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-sm">
        <h1 className="text-base font-semibold">Could not load calls</h1>
        <p className="text-muted-foreground">
          The database could not be reached. Check that{" "}
          <code className="font-mono text-xs">DATABASE_URL</code> is set for
          this environment and that the Neon project is available.
        </p>
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </div>
  )
}
