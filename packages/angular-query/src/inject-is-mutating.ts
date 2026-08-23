import { assertInInjectionContext, computed, inject } from '@angular/core'
import { QueryClient } from '@tanstack/query-core'
import { injectReactiveSubscription } from './utils/inject-reactive-subscription'
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
  const queryClient = inject(QueryClient)

  const cache = queryClient.getMutationCache()
  const resultSource = computed(() => queryClient.isMutating(filters))

  return injectReactiveSubscription({
    updateSource: resultSource,
    getSnapshot: () => queryClient.isMutating(filters),
    subscribe: (onStoreChange) => cache.subscribe(onStoreChange),
  })
}
