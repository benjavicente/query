import { DestroyRef, PendingTasks } from '@angular/core'
import type { Injector } from '@angular/core'

export interface QueryLifecycle {
  readonly destroyed: boolean
  setPending: (pending: boolean) => void
}

export function injectQueryLifecycle(injector: Injector): QueryLifecycle {
  const destroyRef = injector.get(DestroyRef)
  const pendingTasks = injector.get(PendingTasks)
  let destroyed = false
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
