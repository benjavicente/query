import { DestroyRef, PendingTasks, runInInjectionContext } from '@angular/core'
import { describe, expect, it, vi } from 'vitest'
import { DestroyRefCompat } from '../utils/destroy-ref-compat'
import { injectPendingTasksLifecycle } from '../utils/inject-pending-tasks-lifecycle'
import type { Injector } from '@angular/core'

function setupLifecycle(withNativeDestroyed = false) {
  const destroyCallbacks: Array<() => void> = []
  const taskCleanups: Array<ReturnType<typeof vi.fn>> = []
  const pendingTasks = {
    add: vi.fn(() => {
      const cleanup = vi.fn()
      taskCleanups.push(cleanup)
      return cleanup
    }),
  }
  const destroyRef: {
    destroyed?: boolean
    onDestroy: ReturnType<typeof vi.fn>
  } = {
    onDestroy: vi.fn((callback: () => void) => {
      destroyCallbacks.push(callback)
      return () => {
        const index = destroyCallbacks.indexOf(callback)
        if (index !== -1) destroyCallbacks.splice(index, 1)
      }
    }),
  }
  if (withNativeDestroyed) destroyRef.destroyed = false
  const injector = {
    get(token: unknown) {
      if (token === DestroyRefCompat) return null
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
    destroy: () => {
      if (withNativeDestroyed) destroyRef.destroyed = true
      for (const callback of [...destroyCallbacks]) callback()
    },
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

  it('uses the native Angular 20.1 DestroyRef state when available', () => {
    const { lifecycle, destroy } = setupLifecycle(true)

    expect(lifecycle.destroyed).toBe(false)
    destroy()
    expect(lifecycle.destroyed).toBe(true)
  })

  it('uses a DestroyRefCompat override from the injection context', () => {
    let destroyed = false
    const destroyCallbacks: Array<() => void> = []
    const taskCleanup = vi.fn()
    const destroyRefCompat: DestroyRefCompat = {
      get destroyed() {
        return destroyed
      },
      onDestroy(callback) {
        destroyCallbacks.push(callback)
        return () => undefined
      },
    }
    const pendingTasks = { add: vi.fn(() => taskCleanup) }
    const injector = {
      get(token: unknown) {
        if (token === DestroyRefCompat) return destroyRefCompat
        if (token === PendingTasks) return pendingTasks
        throw new Error(`Unexpected token: ${String(token)}`)
      },
    } as Injector

    const lifecycle = runInInjectionContext(injector, () =>
      injectPendingTasksLifecycle(),
    )
    lifecycle.setPending(true)
    destroyed = true
    for (const callback of destroyCallbacks) callback()

    expect(lifecycle.destroyed).toBe(true)
    expect(taskCleanup).toHaveBeenCalledOnce()
  })
})
