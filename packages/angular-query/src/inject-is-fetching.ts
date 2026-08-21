import {
  DestroyRef,
  NgZone,
  assertInInjectionContext,
  inject,
  linkedSignal,
} from '@angular/core'
import { QueryClient } from '@tanstack/query-core'
import type { QueryFilters } from '@tanstack/query-core'
import type { Signal } from '@angular/core'

/**
 * Injects a signal that tracks the number of queries that your application is loading or
 * fetching in the background.
 *
 * Can be used for app-wide loading indicators
 * @param filters - The filters to apply to the query.
 * @returns signal with number of loading or fetching queries.
 */
export function injectIsFetching(filters?: QueryFilters): Signal<number> {
  assertInInjectionContext(injectIsFetching)
  const destroyRef = inject(DestroyRef)
  const ngZone = inject(NgZone)
  const queryClient = inject(QueryClient)

  const cache = queryClient.getQueryCache()
  const result = linkedSignal(() => queryClient.isFetching(filters))

  const unsubscribe = ngZone.runOutsideAngular(() =>
    cache.subscribe(() => {
      queueMicrotask(() => {
        const newIsFetching = queryClient.isFetching(filters)
        ngZone.run(() => {
          result.set(newIsFetching)
        })
      })
    }),
  )

  destroyRef.onDestroy(unsubscribe)

  return result
}
