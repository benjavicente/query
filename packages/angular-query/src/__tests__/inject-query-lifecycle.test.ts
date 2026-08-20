import { DestroyRef, PendingTasks, runInInjectionContext } from '@angular/core'
import { describe, expect, it, vi } from 'vitest'
import { injectPendingTasksLifecycle } from '../utils/inject-pending-tasks-lifecycle'
import type { Injector } from '@angular/core'

function setupLifecycle() {
  let destroy: (() => void) | undefined
  const taskCleanups: Array<ReturnType<typeof vi.fn>> = []
  const pendingTasks = {
    add: vi.fn(() => {
      const cleanup = vi.fn()
      taskCleanups.push(cleanup)
      return cleanup
    }),
  }
  const destroyRef = {
    onDestroy: vi.fn((callback: () => void) => {
      destroy = callback
      return () => undefined
    }),
  }
  const injector = {
    get(token: unknown) {
      if (token === PendingTasks) return pendingTasks
      if (token === DestroyRef) return destroyRef
      throw new Error(`Unexpected token: ${String(token)}`)
    },
  } as Injector

  return {
    lifecycle: runInInjectionContext(injector, () =>
      injectPendingTasksLifecycle(),
    ),
    pendingTasks,
    taskCleanups,
    destroy: () => destroy?.(),
  }
}

describe('QueryLifecycle', () => {
  it('tracks pending state without registering duplicate tasks', () => {
    const { lifecycle, pendingTasks, taskCleanups } = setupLifecycle()

    lifecycle.setPending(true)
    lifecycle.setPending(true)

    expect(pendingTasks.add).toHaveBeenCalledOnce()

    lifecycle.setPending(false)
    expect(taskCleanups[0]).toHaveBeenCalledOnce()

    lifecycle.setPending(true)
    expect(pendingTasks.add).toHaveBeenCalledTimes(2)
  })

  it('tracks destruction, releases its task, and cannot restart', () => {
    const { lifecycle, pendingTasks, taskCleanups, destroy } = setupLifecycle()

    lifecycle.setPending(true)
    destroy()

    expect(lifecycle.destroyed).toBe(true)
    expect(taskCleanups[0]).toHaveBeenCalledOnce()

    lifecycle.setPending(true)
    expect(pendingTasks.add).toHaveBeenCalledOnce()
  })
})
