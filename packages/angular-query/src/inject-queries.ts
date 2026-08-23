import {
  QueriesObserver,
  QueryClient,
  shouldThrowError,
} from '@tanstack/query-core'
import {
  NgZone,
  assertInInjectionContext,
  computed,
  inject,
  untracked,
} from '@angular/core'
import { signalProxy } from './utils/signal-proxy'
import { injectIsRestoring } from './inject-is-restoring'
import { injectPendingTasksLifecycle } from './utils/inject-pending-tasks-lifecycle'
import { injectReactiveSubscription } from './utils/inject-reactive-subscription'
import type {
  InjectQueriesOptions,
  QueriesResults,
} from './inject-queries.types'
import type {
  QueriesObserverOptions,
  QueryObserverOptions,
  QueryObserverResult,
} from '@tanstack/query-core'
import type { Signal } from '@angular/core'

const methodsToExclude = ['refetch'] as const

/**
 * Injects multiple queries that run in parallel and react to Angular signals.
 *
 * ```ts
 * class UsersComponent {
 *   readonly users = input.required<Array<User>>()
 *
 *   readonly userQueries = injectQueries(() => ({
 *     queries: this.users().map((user) => ({
 *       queryKey: ['user', user.id],
 *       queryFn: () => fetchUserById(user.id),
 *     })),
 *   }))
 * }
 * ```
 *
 * @param optionsFn - A function that returns queries' options.
 * @returns A signal containing the query results in the same order as the input queries.
 */
export function injectQueries<
  T extends Array<any>,
  TCombinedResult = QueriesResults<T>,
>(
  optionsFn: () => InjectQueriesOptions<T, TCombinedResult>,
): Signal<TCombinedResult> {
  assertInInjectionContext(injectQueries)
  const ngZone = inject(NgZone)
  const queryClient = inject(QueryClient)
  const isRestoring = injectIsRestoring()
  const shouldSubscribe = computed(() => !isRestoring())
  const lifecycle = injectPendingTasksLifecycle()

  const optionsSignal = computed(optionsFn)

  const defaultedQueries = computed(() => {
    return optionsSignal().queries.map((opts) => {
      const defaultedOptions = queryClient.defaultQueryOptions(
        opts as QueryObserverOptions,
      )
      defaultedOptions._optimisticResults = isRestoring()
        ? 'isRestoring'
        : 'optimistic'
      defaultedOptions.notifyOnChangeProps = 'all'

      return defaultedOptions as QueryObserverOptions
    })
  })

  const observerOptionsSignal = computed(
    () => optionsSignal() as QueriesObserverOptions<TCombinedResult>,
  )

  const shouldBlockPendingTasks = (
    observer: QueriesObserver<TCombinedResult>,
    results: Array<QueryObserverResult>,
  ) => {
    const queries = observer.getQueries()

    return results.some((result, index) => {
      return (
        queries[index]?.state.fetchStatus !== 'idle' ||
        (result.fetchStatus !== 'idle' && result.isEnabled)
      )
    })
  }

  const observerSignal = computed(
    () =>
      new QueriesObserver<TCombinedResult>(
        queryClient,
        untracked(defaultedQueries),
        untracked(observerOptionsSignal),
      ),
  )

  const getOptimisticResult = (observer: QueriesObserver<TCombinedResult>) => {
    const queries = defaultedQueries()
    const combine = observerOptionsSignal().combine
    const [optimisticResult, getCombinedResult] = observer.getOptimisticResult(
      queries,
      combine,
    )

    return {
      optimisticResult,
      combinedResult: getCombinedResult(optimisticResult),
    }
  }

  const observerUpdateSignal = computed(() => ({
    queries: defaultedQueries(),
    options: observerOptionsSignal(),
  }))

  const resultSignal = injectReactiveSubscription({
    shouldSubscribe,
    updateSource: observerUpdateSignal,
    update: ({ queries, options }) => {
      observerSignal().setQueries(queries, options)
    },
    getSnapshot: () => {
      const observer = observerSignal()
      return getOptimisticResult(observer).combinedResult
    },
    subscribe: (onStoreChange) => {
      const observer = observerSignal()
      const { optimisticResult } = getOptimisticResult(observer)
      lifecycle.setPending(shouldBlockPendingTasks(observer, optimisticResult))

      const unsubscribe = observer.subscribe((state) => {
        lifecycle.setPending(shouldBlockPendingTasks(observer, state))

        if (lifecycle.destroyed) return

        const observers = observer.getObservers()
        const queries = observer.getQueries()
        const resultWhichShouldThrow = state.find((result, index) => {
          const queryObserver = observers[index]
          const query = queries[index]

          return (
            result.isError &&
            !result.isFetching &&
            queryObserver !== undefined &&
            query !== undefined &&
            shouldThrowError(queryObserver.options.throwOnError, [
              result.error,
              query,
            ])
          )
        })

        if (resultWhichShouldThrow) {
          queueMicrotask(() => {
            if (lifecycle.destroyed) return
            ngZone.run(() => {
              ngZone.onError.emit(resultWhichShouldThrow.error)
              throw resultWhichShouldThrow.error
            })
          })
          return
        }

        onStoreChange()
      })

      return () => {
        lifecycle.setPending(false)
        unsubscribe()
      }
    },
  })

  const createResultProxy = (index: number) => {
    const resultAtIndexSignal = computed(
      () => (resultSignal() as Array<QueryObserverResult>)[index]!,
    )
    return signalProxy(resultAtIndexSignal, methodsToExclude)
  }

  const proxiedResultsSignal = computed(() =>
    (resultSignal() as Array<QueryObserverResult>).map((_, index) =>
      createResultProxy(index),
    ),
  )

  return computed(() => {
    const result = resultSignal()
    const { combine } = optionsSignal()

    if (combine) return result

    return proxiedResultsSignal() as unknown as TCombinedResult
  }) as unknown as Signal<TCombinedResult>
}
