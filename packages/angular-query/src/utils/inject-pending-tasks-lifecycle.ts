import { DestroyRef, PendingTasks, inject } from '@angular/core'

export interface QueryLifecycle {
  readonly destroyed: boolean
  setPending: (pending: boolean) => void
}

export function injectPendingTasksLifecycle(): QueryLifecycle {
  const destroyRef = inject(DestroyRef)
  const pendingTasks = inject(PendingTasks)
  let destroyed = false // In Angular >= 20.1, read destroyRef.destroyed directly
  let taskCleanup: (() => void) | undefined

  const lifecycle: QueryLifecycle = {
    get destroyed() {
      return destroyed
    },
    setPending(pending) {
      if (pending) {
        if (!destroyed && !taskCleanup) {
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
    destroyed = true
    lifecycle.setPending(false)
  })

  return lifecycle
}
