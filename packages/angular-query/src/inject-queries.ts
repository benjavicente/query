import { QueriesObserver, QueryClient } from '@tanstack/query-core'
import {
  assertInInjectionContext,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core'
import { signalProxy } from './utils/signal-proxy'
import { queryResultFields } from './utils/result-fields'
import { injectIsRestoring } from './inject-is-restoring'
import { injectPendingTasksLifecycle } from './utils/inject-pending-tasks-lifecycle'
import { injectExternalStore } from './utils/inject-external-store'
import type {
  InjectQueriesOptions,
  QueriesResults,
} from './inject-queries.types'
import type {
  QueryObserverOptions,
  QueryObserverResult,
} from '@tanstack/query-core'
import type { Signal } from '@angular/core'

/**
 * Injects multiple queries that run in parallel and react to Angular signals.
 *
 * @see https://tanstack.com/query/latest/docs/framework/angular/guides/parallel-queries
 * @param optionsFn - A function that returns the queries' options. Similar to `computed` from Angular,
 * this function runs in the reactive context, so signals read inside it drive the queries.
 * @returns A signal containing the query results in the same order as the input queries.
 *
 * @example
 * ```angular-ts
 * @Component({
 *   selector: 'users',
 *   template: `
 *     @for (query of userQueries(); track $index) {
 *       @if (query.isSuccess()) {
 *         <p>{{ query.data().name }}</p>
 *       }
 *     }
 *   `,
 * })
 * export class UsersComponent {
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
 */
export function injectQueries<
  T extends Array<any>,
  TCombinedResult = QueriesResults<T>,
>(
  optionsFn: () => InjectQueriesOptions<T, TCombinedResult>,
): Signal<TCombinedResult> {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    assertInInjectionContext(injectQueries)
  }
  const queryClient = inject(QueryClient)
  const isRestoring = injectIsRestoring()
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

  // The observer is intentionally lazy so query factories may read required
  // inputs. Its first construction and subscription can synchronously emit
  // QueryCache events; a listener for either initial event must not re-enter this
  // same, not-yet-initialized result. Subscription setup and cleanup must not synchronously
  // read these results during reconciliation.
  const observerSignal = computed(
    () =>
      new QueriesObserver<TCombinedResult>(
        queryClient,
        untracked(defaultedQueries),
      ),
  )

  // Configure the observer outside the result computation. Cache listeners can
  // synchronously read public results while setQueries notifies.
  effect(() => {
    const queries = defaultedQueries()
    untracked(() => observerSignal().setQueries(queries))
  })

  // Methods address the current array slot, including methods handed to combine.
  const refetches: Array<QueryObserverResult['refetch']> = []
  const getRefetch = (index: number): QueryObserverResult['refetch'] =>
    (refetches[index] ??= (options) =>
      untracked(() => {
        const observer = observerSignal()
        observer.setQueries(defaultedQueries())
        resultSignal()
        const queryObserver = observer.getObservers()[index]
        if (!queryObserver) {
          return Promise.reject(
            new Error(`Cannot refetch removed query at index ${index}`),
          )
        }
        return queryObserver.refetch(options)
      }))

  const resultSignal = injectExternalStore(() => {
    const observer = observerSignal()
    const restoring = isRestoring()
    return {
      getSnapshot: () => {
        const results = observer.getOptimisticResult(
          defaultedQueries(),
          undefined,
        )[0]
        refetches.length = results.length
        return results.map((result, index) => ({
          ...result,
          refetch: getRefetch(index),
        }))
      },
      subscribe: restoring
        ? undefined
        : (onStoreChange) => {
            lifecycle.setPending(
              shouldBlockPendingTasks(observer, observer.getCurrentResult()),
            )
            const unsubscribe = observer.subscribe((state) => {
              if (lifecycle.destroyed) return
              if (shouldBlockPendingTasks(observer, state))
                lifecycle.setPending(true)
              onStoreChange()
              lifecycle.setPending(
                shouldBlockPendingTasks(observer, observer.getCurrentResult()),
              )
            })
            return () => {
              lifecycle.setPending(false)
              unsubscribe()
            }
          },
    }
  })

  const createResultProxy = (index: number) => {
    const resultAtIndexSignal = computed(() => resultSignal()[index]!)
    return Object.assign(signalProxy(resultAtIndexSignal, queryResultFields), {
      refetch: getRefetch(index),
    })
  }

  const resultProxies: Array<ReturnType<typeof createResultProxy>> = []
  const proxiedResultsSignal = computed(() => {
    const results = resultSignal()
    resultProxies.length = results.length

    return results.map((_, index) => {
      return (resultProxies[index] ??= createResultProxy(index))
    })
  })

  // Combine in Angular's tracked computation. Core must notify for every raw
  // result change, including changes a previous combine function ignored.
  return computed(() => {
    const result = resultSignal()
    const { combine } = optionsSignal()

    if (combine)
      return combine(result as Parameters<NonNullable<typeof combine>>[0])

    return proxiedResultsSignal() as unknown as TCombinedResult
  }) as unknown as Signal<TCombinedResult>
}
