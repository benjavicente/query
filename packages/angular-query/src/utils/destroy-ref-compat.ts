import { DestroyRef, InjectionToken, inject } from '@angular/core'

export interface DestroyRefCompat extends DestroyRef {
  readonly destroyed: boolean
}

/** Allows scoped providers and tests to override the local DestroyRef wrapper. */
export const DestroyRefCompat = new InjectionToken<DestroyRefCompat>(
  'TanStack Query DestroyRefCompat',
)

export function injectDestroyRefCompat(): DestroyRefCompat {
  const override = inject(DestroyRefCompat, { optional: true })
  if (override) return override

  const destroyRef = inject(DestroyRef)
  const maybeDestroyRef = destroyRef as unknown as {
    readonly destroyed?: boolean
  }
  let destroyedFallback = false

  destroyRef.onDestroy(() => {
    destroyedFallback = true
  })

  return {
    get destroyed() {
      return maybeDestroyRef.destroyed ?? destroyedFallback
    },
    onDestroy: (callback) => destroyRef.onDestroy(callback),
  }
}
