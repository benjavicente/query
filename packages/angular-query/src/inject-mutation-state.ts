import {
  DestroyRef,
  NgZone,
  assertInInjectionContext,
  inject,
  linkedSignal,
} from '@angular/core'
import { QueryClient, replaceEqualDeep } from '@tanstack/query-core'
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
  const destroyRef = inject(DestroyRef)
  const ngZone = inject(NgZone)
  const queryClient = inject(QueryClient)
  const mutationCache = queryClient.getMutationCache()

  const resultSignal = linkedSignal<Array<TResult>, Array<TResult>>({
    source: () => getResult(mutationCache, options()),
    computation: (result, previous) =>
      replaceEqualDeep(previous?.value, result),
  })

  const unsubscribe = ngZone.runOutsideAngular(() =>
    mutationCache.subscribe(() => {
      const nextResult = getResult(mutationCache, options())
      ngZone.run(() => {
        resultSignal.update((lastResult) =>
          replaceEqualDeep(lastResult, nextResult),
        )
      })
    }),
  )

  destroyRef.onDestroy(unsubscribe)

  return resultSignal.asReadonly()
}
