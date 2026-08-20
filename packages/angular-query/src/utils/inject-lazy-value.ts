import {
  DestroyRef,
  Injector,
  inject,
  runInInjectionContext,
} from '@angular/core'
import { untracked } from '@angular/core/primitives/signals'

export type CleanupFn = () => void

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
  effectWithCleanup?: (value: T) => CleanupFn | void,
): () => T {
  const destroyRef = inject(DestroyRef)
  const injector = inject(Injector)

  let value: T | typeof sentinel = sentinel

  return () => {
    if (value === sentinel) {
      // Do not track in current context if any
      const val = untracked(factory)
      value = val

      if (effectWithCleanup) {
        const cleanup = runInInjectionContext(injector, () =>
          untracked(() => effectWithCleanup(val)),
        )

        if (cleanup) {
          destroyRef.onDestroy(cleanup)
        }
      }
    }
    return value
  }
}
