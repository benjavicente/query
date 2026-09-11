import { computed, effect, inject, untracked } from '@angular/core'
import { QueryClient } from '@tanstack/query-core'
import { injectIsRestoring } from './inject-is-restoring'
import { injectPendingTasksLifecycle } from './utils/inject-pending-tasks-lifecycle'
import { injectExternalStore } from './utils/inject-external-store'
import type {
  QueryKey,
  QueryObserver,
  QueryObserverOptions,
  QueryObserverResult,
} from '@tanstack/query-core'

/**
 * Base implementation for `injectQuery` and `injectInfiniteQuery`.
 * @param optionsFn
 * @param Observer
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
) {
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

  // The observer is intentionally lazy so options may read required inputs. Its
  // first construction and subscription can synchronously emit QueryCache
  // events; a listener for either initial event must not re-enter this same,
  // not-yet-initialized result. Subscription setup and cleanup must not synchronously read
  // this result during reconciliation.
  const observerSignal = computed(
    () => new Observer(queryClient, untracked(defaultedOptionsSignal)),
  )

  // Configure the observer outside the result computation. Cache listeners can
  // synchronously read the public result while setOptions notifies.
  effect(() => {
    const options = defaultedOptionsSignal()
    untracked(() => observerSignal().setOptions(options))
  })

  const resultSignal = injectExternalStore(() => {
    const observer = observerSignal()
    const restoring = isRestoring()
    return {
      getSnapshot: () => observer.getOptimisticResult(defaultedOptionsSignal()),
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
              // Notify before releasing work so dependent queries can be scheduled.
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

  // Every imperative method uses current options and initializes observation
  // before starting work, even when invoked before Angular's effects run.
  const getObserver = () =>
    untracked(() => {
      const observer = observerSignal()
      observer.setOptions(defaultedOptionsSignal())
      resultSignal()
      return observer
    })

  return [resultSignal, getObserver] as const
}
