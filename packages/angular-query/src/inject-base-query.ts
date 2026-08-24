import { NgZone, computed, inject, untracked } from '@angular/core'
import { QueryClient, shouldThrowError } from '@tanstack/query-core'
import { signalProxy } from './utils/signal-proxy'
import { injectIsRestoring } from './inject-is-restoring'
import { injectPendingTasksLifecycle } from './utils/inject-pending-tasks-lifecycle'
import { injectObserverSignal } from './utils/inject-observer-signal'
import type {
  QueryKey,
  QueryObserver,
  QueryObserverOptions,
  QueryObserverResult,
} from '@tanstack/query-core'
import type { MethodKeys } from './utils/signal-proxy'

/**
 * Base implementation for `injectQuery` and `injectInfiniteQuery`.
 * @param optionsFn
 * @param Observer
 * @param excludeFunctions
 */
export function injectBaseQuery<
  TQueryFnData,
  TError,
  TData,
  TQueryData,
  TQueryKey extends QueryKey,
>(
  optionsFn: () => QueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
  Observer: typeof QueryObserver,
  excludeFunctions: ReadonlyArray<string>,
) {
  const ngZone = inject(NgZone)
  const queryClient = inject(QueryClient)
  const isRestoring = injectIsRestoring()
  const lifecycle = injectPendingTasksLifecycle()

  const shouldBlockPendingTasks = (
    observer: QueryObserver<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    result: QueryObserverResult<TData, TError>,
  ) => {
    return (
      observer.getCurrentQuery().state.fetchStatus !== 'idle' ||
      (result.fetchStatus !== 'idle' && result.isEnabled)
    )
  }

  /**
   * Signal that has the default options from query client applied
   * computed() is used so signals can be inserted into the options
   * making it reactive. Wrapping options in a function ensures embedded expressions
   * are preserved and can keep being applied after signal changes
   */
  const defaultedOptionsSignal = computed(() => {
    const defaultedOptions = queryClient.defaultQueryOptions(optionsFn())
    defaultedOptions._optimisticResults = isRestoring()
      ? 'isRestoring'
      : 'optimistic'
    defaultedOptions.notifyOnChangeProps = 'all'
    return defaultedOptions
  })

  const observerSignal = computed(
    () => new Observer(queryClient, untracked(defaultedOptionsSignal)),
  )

  const resultSignal = injectObserverSignal({
    updateSource: defaultedOptionsSignal,
    update: (options) => observerSignal().setOptions(options),
    getSnapshot: () => {
      const observer = observerSignal()
      const defaultedOptions = defaultedOptionsSignal()

      return observer.getOptimisticResult(defaultedOptions)
    },
    subscribe: (onStoreChange) => {
      if (isRestoring()) return undefined

      const observer = observerSignal()
      const initialState = observer.getCurrentResult()
      lifecycle.setPending(shouldBlockPendingTasks(observer, initialState))

      const unsubscribe = observer.subscribe((state) => {
        lifecycle.setPending(shouldBlockPendingTasks(observer, state))

        if (lifecycle.destroyed) return
        const shouldThrow =
          state.isError &&
          !state.isFetching &&
          shouldThrowError(observer.options.throwOnError, [
            state.error,
            observer.getCurrentQuery(),
          ])

        if (shouldThrow) {
          queueMicrotask(() => {
            if (lifecycle.destroyed) return
            ngZone.run(() => {
              ngZone.onError.emit(state.error)
              throw state.error
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

  return signalProxy(
    resultSignal,
    excludeFunctions as Array<MethodKeys<QueryObserverResult<TData, TError>>>,
  )
}
