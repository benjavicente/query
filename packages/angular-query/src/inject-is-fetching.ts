import { assertInInjectionContext, computed, inject } from '@angular/core'
import { QueryClient } from '@tanstack/query-core'
import { injectReactiveSubscription } from './utils/inject-reactive-subscription'
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
  const queryClient = inject(QueryClient)

  const cache = queryClient.getQueryCache()
  const resultSource = computed(() => queryClient.isFetching(filters))

  return injectReactiveSubscription({
    updateSource: resultSource,
    getSnapshot: () => queryClient.isFetching(filters),
    subscribe: (onStoreChange) => cache.subscribe(onStoreChange),
  })
}
