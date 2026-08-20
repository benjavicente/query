import { DestroyRef, inject } from '@angular/core'
import { untracked } from '@angular/core/primitives/signals'

type CleanupFn = () => void

const sentinel = Symbol()

/**
 * Helper to work with values that depend on Angular Signals and that have a
 * registration effect called on the first read of the value.
 *
 * @param factory Factory of the value to lazy initialize
 * @param effectWithCleanup Function that will run on initialization, with a optional cleanup fn
 * @returns A function to get the value lazily
 */
export function injectLazyValue<T>(
  factory: () => T,
  effectWithCleanup?: (value: T) => CleanupFn | undefined,
): () => T {
  const destroyRef = inject(DestroyRef)
  let value: T | typeof sentinel = sentinel

  return () => {
    if (value === sentinel) {
      // Do not track in current context if any
      value = untracked(() => {
        const val = factory()
        if (effectWithCleanup) {
          const maybeCleanup = effectWithCleanup(val)
          if (maybeCleanup) {
            destroyRef.onDestroy(maybeCleanup)
          }
        }
        return val
      })
    }
    return value
  }
}
