"use client"

import { AlertDialog } from "@base-ui/react/alert-dialog"
import { Trash2 } from "lucide-react"
import { useActionState, useState } from "react"

import { deleteCall, type DeleteCallState } from "@/app/actions"
import { Button } from "@/components/ui/button"

export function DeleteCallButton({
  callId,
  reviewCount,
}: {
  callId: string
  /** Review decisions (full history) that will be deleted with the call. */
  reviewCount: number
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<DeleteCallState, FormData>(
    deleteCall,
    {}
  )

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialog.Trigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="ml-auto border-red-600 text-red-800 hover:bg-red-50 hover:text-red-800 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-900/40"
          />
        }
      >
        <Trash2 aria-hidden="true" />
        Delete call
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-xl transition-all data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <AlertDialog.Title className="text-base font-semibold">
            Delete {callId}?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 space-y-2 text-sm text-muted-foreground">
            <span className="block">
              The call&apos;s transcript and summary will be permanently
              removed from the database.
            </span>
            <span className="block font-medium text-foreground">
              {reviewCount > 0
                ? `Its ${reviewCount} review decision${reviewCount === 1 ? "" : "s"} will be deleted too.`
                : "It has no reviews."}{" "}
              This cannot be undone.
            </span>
          </AlertDialog.Description>

          {state.error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <form action={formAction} className="mt-5 flex justify-end gap-2">
            <input type="hidden" name="callId" value={callId} />
            <AlertDialog.Close
              render={<Button type="button" variant="outline" disabled={pending} />}
            >
              Cancel
            </AlertDialog.Close>
            <Button
              type="submit"
              disabled={pending}
              className="bg-red-700 text-white hover:bg-red-800 focus-visible:ring-foreground"
            >
              <Trash2 aria-hidden="true" />
              {pending ? "Deleting…" : "Delete call"}
            </Button>
          </form>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
