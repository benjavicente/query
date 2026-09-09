import { DestroyRef, NgZone, PendingTasks, inject } from '@angular/core'

export interface QueryLifecycle {
  readonly destroyed: boolean
  setPending: (pending: boolean) => void
}

/** Tracks pending work for the lifetime of the current injection context. */
export function injectPendingTasksLifecycle(): QueryLifecycle {
  const destroyRef = inject(DestroyRef)
  const pendingTasks = inject(PendingTasks)
  const ngZone = inject(NgZone)
  let taskCleanup: (() => void) | undefined

  const lifecycle: QueryLifecycle = {
    get destroyed() {
      return destroyRef.destroyed
    },
    setPending(pending) {
      if (pending) {
        if (!destroyRef.destroyed && !taskCleanup) {
          taskCleanup = pendingTasks.add()
        }
        return
      }

      const cleanup = taskCleanup
      taskCleanup = undefined
      // Enter NgZone while our task is still held to avoid transient stability
      // before dependent queries are scheduled. Reproduced with Zone.js on
      // Angular 20, 21, and 22 (including 22.2.0-next.5); see the version matrix
      // in ANGULAR-DECISIONS.md.
      // In zoneless apps, NgZone.run simply invokes the cleanup.
      if (cleanup) ngZone.run(cleanup)
    },
  }

  destroyRef.onDestroy(() => {
    lifecycle.setPending(false)
  })

  return lifecycle
}
