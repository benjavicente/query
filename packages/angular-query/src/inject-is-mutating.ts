import {
  DestroyRef,
  NgZone,
  assertInInjectionContext,
  inject,
  linkedSignal,
} from '@angular/core'
import { QueryClient } from '@tanstack/query-core'
import type { MutationFilters } from '@tanstack/query-core'
import type { Signal } from '@angular/core'

/**
 * Injects a signal that tracks the number of mutations that your application is fetching.
 *
 * Can be used for app-wide loading indicators
 * @param filters - The filters to apply to the query.
 * @returns A read-only signal with the number of fetching mutations.
 */
export function injectIsMutating(filters?: MutationFilters): Signal<number> {
  assertInInjectionContext(injectIsMutating)
  const destroyRef = inject(DestroyRef)
  const ngZone = inject(NgZone)
  const queryClient = inject(QueryClient)

  const cache = queryClient.getMutationCache()
  const result = linkedSignal(() => queryClient.isMutating(filters))

  const unsubscribe = ngZone.runOutsideAngular(() =>
    cache.subscribe(() => {
      const newIsMutating = queryClient.isMutating(filters)
      ngZone.run(() => {
        result.set(newIsMutating)
      })
    }),
  )

  destroyRef.onDestroy(unsubscribe)

  return result.asReadonly()
}
