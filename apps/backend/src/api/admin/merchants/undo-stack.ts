// A list of things to undo, run last in first out. Used when a job of several
// steps fails half way: every step that worked adds how to take it back.
// No framework imports, so it can be unit tested on its own.

import { errorText } from "../../error-text"

export type UndoFailure = {
  label: string
  error: string
}

export function createUndoStack() {
  const entries: Array<{ label: string; undo: () => Promise<unknown> }> = []

  return {
    add(label: string, undo: () => Promise<unknown>) {
      entries.push({ label, undo })
    },

    get size() {
      return entries.length
    },

    // Runs every undo, newest first. One that fails does not stop the others;
    // the failures are returned so they can be reported. The list is empty
    // afterwards.
    async rollback(): Promise<UndoFailure[]> {
      const failed: UndoFailure[] = []
      while (entries.length > 0) {
        const entry = entries.pop() as { label: string; undo: () => Promise<unknown> }
        try {
          await entry.undo()
        } catch (err) {
          failed.push({
            label: entry.label,
            error: errorText(err),
          })
        }
      }
      return failed
    },
  }
}
