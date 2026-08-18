import {
  Injector,
  NgZone,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core'
import {
  QueryClient,
  notifyManager,
  shouldThrowError,
} from '@tanstack/query-core'
import { signalProxy } from './signal-proxy'
import { injectIsRestoring } from './inject-is-restoring'
import { injectQueryLifecycle } from './inject-query-lifecycle'
import type {
  DefaultedQueryObserverOptions,
  QueryKey,
  QueryObserver,
  QueryObserverResult,
} from '@tanstack/query-core'
import type { CreateBaseQueryOptions } from './types'
import type { MethodKeys } from './signal-proxy'

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
  optionsFn: () => CreateBaseQueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
  Observer: typeof QueryObserver,
  excludeFunctions: ReadonlyArray<string>,
) {
  const injector = inject(Injector)
  const ngZone = inject(NgZone)
  const queryClient = inject(QueryClient)
  const isRestoring = injectIsRestoring()
  const lifecycle = injectQueryLifecycle(injector)

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
    return defaultedOptions
  })

  // Computed without deps to lazy initialize the observer
  const observerSignal = computed(() => {
    return new Observer(queryClient, untracked(defaultedOptionsSignal))
  })

  effect(() => {
    observerSignal().setOptions(defaultedOptionsSignal())
  })

  const trackObserverResult = (
    result: QueryObserverResult<TData, TError>,
    notifyOnChangeProps?: DefaultedQueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >['notifyOnChangeProps'],
  ) => {
    const observer = untracked(observerSignal)
    const trackedResult = observer.trackResult(result)

    if (!notifyOnChangeProps) {
      autoTrackResultProperties(trackedResult)
    }

    return trackedResult
  }

  const autoTrackResultProperties = (
    result: QueryObserverResult<TData, TError>,
  ) => {
    for (const key of Object.keys(result) as Array<
      keyof QueryObserverResult<TData, TError>
    >) {
      if (key === 'promise') continue
      const value = result[key]
      if (typeof value === 'function') continue
      // Access value once so QueryObserver knows this prop is tracked.
      void value
    }
  }

  const subscribeToObserver = () => {
    const observer = untracked(observerSignal)
    const initialState = observer.getCurrentResult()
    lifecycle.setPending(shouldBlockPendingTasks(observer, initialState))

    return observer.subscribe((state) => {
      lifecycle.setPending(shouldBlockPendingTasks(observer, state))

      queueMicrotask(() => {
        if (lifecycle.destroyed) return
        notifyManager.batch(() => {
          ngZone.run(() => {
            if (
              state.isError &&
              !state.isFetching &&
              shouldThrowError(observer.options.throwOnError, [
                state.error,
                observer.getCurrentQuery(),
              ])
            ) {
              ngZone.onError.emit(state.error)
              throw state.error
            }
            const trackedState = trackObserverResult(
              state,
              observer.options.notifyOnChangeProps,
            )
            resultSignal.set(trackedState)
          })
        })
      })
    })
  }

  const resultSignal = linkedSignal({
    source: defaultedOptionsSignal,
    computation: () => {
      const observer = untracked(observerSignal)
      const defaultedOptions = defaultedOptionsSignal()

      const result = observer.getOptimisticResult(defaultedOptions)
      return trackObserverResult(result, defaultedOptions.notifyOnChangeProps)
    },
  })

  effect((onCleanup) => {
    if (isRestoring()) {
      return
    }
    const unsubscribe = untracked(() =>
      ngZone.runOutsideAngular(() => subscribeToObserver()),
    )
    onCleanup(() => {
      unsubscribe()
      lifecycle.setPending(false)
    })
  })

  return signalProxy(
    resultSignal.asReadonly(),
    excludeFunctions as Array<MethodKeys<QueryObserverResult<TData, TError>>>,
  )
}
