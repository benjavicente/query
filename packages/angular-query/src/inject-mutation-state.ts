import { assertInInjectionContext, computed, inject } from '@angular/core'
import { QueryClient } from '@tanstack/query-core'
import { injectReactiveSubscription } from './utils/inject-reactive-subscription'
import type { Signal } from '@angular/core'
import type {
  Mutation,
  MutationCache,
  MutationFilters,
  MutationState,
} from '@tanstack/query-core'

export type MutationStateOptions<TResult = MutationState> = {
  filters?: MutationFilters
  select?: (mutation: Mutation) => TResult
}

function getResult<TResult = MutationState>(
  mutationCache: MutationCache,
  options: MutationStateOptions<TResult>,
): Array<TResult> {
  return mutationCache
    .findAll(options.filters)
    .map(
      (mutation): TResult =>
        (options.select ? options.select(mutation) : mutation.state) as TResult,
    )
}

/**
 * Injects a signal that tracks the state of all mutations.
 * @param options - A function that returns mutation state options.
 * @returns The signal that tracks the state of all mutations.
 */
export function injectMutationState<TResult = MutationState>(
  options: () => MutationStateOptions<TResult> = () => ({}),
): Signal<Array<TResult>> {
  assertInInjectionContext(injectMutationState)
  const queryClient = inject(QueryClient)
  const mutationCache = queryClient.getMutationCache()
  const optionsSignal = computed(options)

  return injectReactiveSubscription({
    updateSource: optionsSignal,
    getSnapshot: () => getResult(mutationCache, optionsSignal()),
    subscribe: (onStoreChange) => mutationCache.subscribe(onStoreChange),
  })
}
