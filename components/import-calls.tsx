"use client"

import { CircleAlert, CircleCheck, Upload, X } from "lucide-react"
import { useActionState, useRef, useState } from "react"

import { importCalls, type ImportCallsState } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { MAX_IMPORT_BYTES } from "@/lib/call-import"
import { cn } from "@/lib/utils"

function IdList({ ids, max = 6 }: { ids: string[]; max?: number }) {
  const shown = ids.slice(0, max)
  return (
    <span className="font-mono">
      {shown.join(", ")}
      {ids.length > max && ` and ${ids.length - max} more`}
    </span>
  )
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

export function ImportCalls() {
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, formAction, pending] = useActionState<ImportCallsState, FormData>(
    importCalls,
    { status: "idle" }
  )
  const [localError, setLocalError] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  function onFileChosen(file: File | undefined) {
    if (!file) return
    setVisible(true)
    if (file.size > MAX_IMPORT_BYTES) {
      setLocalError(
        `${file.name} is larger than ${(MAX_IMPORT_BYTES / 1_000_000).toFixed(1)} MB. Split it into smaller files.`
      )
      if (inputRef.current) inputRef.current.value = ""
      return
    }
    setLocalError(null)
    formRef.current?.requestSubmit()
  }

  const showError = localError !== null || state.status === "error"
  const showResult = visible && !pending && (showError || state.status === "done")

  return (
    <div className="mt-3 space-y-2">
      <form
        ref={formRef}
        action={(fd) => {
          formAction(fd)
          // The file is already captured in `fd`; clear the input so the same
          // file can be chosen again later.
          if (inputRef.current) inputRef.current.value = ""
        }}
      >
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => onFileChosen(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          aria-describedby="import-help"
        >
          <Upload aria-hidden="true" />
          {pending ? "Importing…" : "Import calls"}
        </Button>
        <p id="import-help" className="sr-only">
          Choose a JSON file in the candidate-calls format. Calls whose ID
          already exists are skipped and left unchanged.
        </p>
      </form>

      <div aria-live="polite" role="status">
        {pending && <p className="sr-only">Importing calls…</p>}
        {showResult && (
          <div
            className={cn(
              "relative rounded-lg border p-2.5 pr-7 text-xs leading-relaxed",
              showError
                ? "border-red-600/50 bg-red-50 text-red-900 dark:bg-red-900/35 dark:text-red-100"
                : "border-emerald-600/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/35 dark:text-emerald-100"
            )}
          >
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="absolute top-1.5 right-1.5 rounded p-0.5 hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none dark:hover:bg-white/10"
              aria-label="Dismiss import result"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>

            {localError !== null ? (
              <p className="flex gap-1.5">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {localError}
              </p>
            ) : state.status === "error" ? (
              <div className="space-y-1">
                <p className="flex gap-1.5 font-semibold">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  Nothing imported{state.fileName && ` from ${state.fileName}`}
                </p>
                <ul className="ml-5 list-disc space-y-0.5 wrap-break-word">
                  {state.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                {state.errorCount > state.errors.length && (
                  <p className="ml-5">
                    …and {plural(state.errorCount - state.errors.length, "more problem")}.
                  </p>
                )}
              </div>
            ) : state.status === "done" ? (
              <div className="space-y-1">
                <p className="flex gap-1.5 font-semibold">
                  <CircleCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {state.added.length
                    ? `${plural(state.added.length, "call")} imported`
                    : "No new calls"}
                </p>
                {state.added.length > 0 && (
                  <p>
                    Added: <IdList ids={state.added} />
                  </p>
                )}
                {state.skippedExisting.length > 0 && (
                  <p>
                    {plural(state.skippedExisting.length, "duplicate")} skipped,
                    existing data unchanged: <IdList ids={state.skippedExisting} />
                  </p>
                )}
                {state.repeatedInFile.length > 0 && (
                  <p>
                    Repeated in the file (first copy used):{" "}
                    <IdList ids={state.repeatedInFile} />
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
