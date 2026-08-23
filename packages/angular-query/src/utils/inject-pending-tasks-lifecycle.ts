import { PendingTasks, inject } from '@angular/core'
import { injectDestroyRefCompat } from './destroy-ref-compat'

export interface QueryLifecycle {
  readonly destroyed: boolean
  setPending: (pending: boolean) => void
}

/** Tracks pending work for the lifetime of the current injection context. */
export function injectPendingTasksLifecycle(): QueryLifecycle {
  const destroyRef = injectDestroyRefCompat()
  const pendingTasks = inject(PendingTasks)
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
      cleanup?.()
    },
  }

  destroyRef.onDestroy(() => {
    lifecycle.setPending(false)
  })

  return lifecycle
}
