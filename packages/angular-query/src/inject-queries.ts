import {
  QueriesObserver,
  QueryClient,
  shouldThrowError,
} from '@tanstack/query-core'
import {
  NgZone,
  assertInInjectionContext,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core'
import { signalProxy } from './utils/signal-proxy'
import { injectIsRestoring } from './inject-is-restoring'
import { injectPendingTasksLifecycle } from './utils/inject-pending-tasks-lifecycle'
import { injectLazyValue } from './utils/inject-lazy-value'
import type {
  DefaultError,
  DefinedQueryObserverResult,
  OmitKeyof,
  QueriesObserverOptions,
  QueriesPlaceholderDataFunction,
  QueryFunction,
  QueryKey,
  QueryObserverOptions,
  QueryObserverResult,
  ThrowOnError,
} from '@tanstack/query-core'
import type {
  CreateQueryOptions,
  CreateQueryResult,
  DefinedCreateQueryResult,
} from './types'
import type { Signal } from '@angular/core'
import type { CleanupFn } from './utils/inject-lazy-value'

// This defines the `CreateQueryOptions` that are accepted in `QueriesOptions` & `GetOptions`.
// `placeholderData` function always gets undefined passed
type QueryObserverOptionsForCreateQueries<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = OmitKeyof<
  CreateQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  'placeholderData'
> & {
  placeholderData?: TQueryFnData | QueriesPlaceholderDataFunction<TQueryFnData>
}

// Avoid TS depth-limit error in case of large array literal
type MAXIMUM_DEPTH = 20

// Widen the type of the symbol to enable type inference even if skipToken is not immutable.
type SkipTokenForCreateQueries = symbol

type GetCreateQueryOptionsForCreateQueries<T> =
  // Part 1: responsible for applying explicit type parameter to function arguments, if object { queryFnData: TQueryFnData, error: TError, data: TData }
  T extends {
    queryFnData: infer TQueryFnData
    error?: infer TError
    data: infer TData
  }
    ? QueryObserverOptionsForCreateQueries<TQueryFnData, TError, TData>
    : T extends { queryFnData: infer TQueryFnData; error?: infer TError }
      ? QueryObserverOptionsForCreateQueries<TQueryFnData, TError>
      : T extends { data: infer TData; error?: infer TError }
        ? QueryObserverOptionsForCreateQueries<unknown, TError, TData>
        : // Part 2: responsible for applying explicit type parameter to function arguments, if tuple [TQueryFnData, TError, TData]
          T extends [infer TQueryFnData, infer TError, infer TData]
          ? QueryObserverOptionsForCreateQueries<TQueryFnData, TError, TData>
          : T extends [infer TQueryFnData, infer TError]
            ? QueryObserverOptionsForCreateQueries<TQueryFnData, TError>
            : T extends [infer TQueryFnData]
              ? QueryObserverOptionsForCreateQueries<TQueryFnData>
              : // Part 3: responsible for inferring and enforcing type if no explicit parameter was provided
                T extends {
                    queryFn?:
                      | QueryFunction<infer TQueryFnData, infer TQueryKey>
                      | SkipTokenForCreateQueries
                    select?: (data: any) => infer TData
                    throwOnError?: ThrowOnError<any, infer TError, any, any>
                  }
                ? QueryObserverOptionsForCreateQueries<
                    TQueryFnData,
                    unknown extends TError ? DefaultError : TError,
                    unknown extends TData ? TQueryFnData : TData,
                    TQueryKey
                  >
                : // Fallback
                  QueryObserverOptionsForCreateQueries

// Generic wrapper that handles initialData logic for any result type pair
type GenericGetDefinedOrUndefinedQueryResult<T, TData, TUndefined, TDefined> =
  T extends {
    initialData?: infer TInitialData
  }
    ? unknown extends TInitialData
      ? TUndefined
      : TInitialData extends TData
        ? TDefined
        : TInitialData extends () => infer TInitialDataResult
          ? unknown extends TInitialDataResult
            ? TUndefined
            : TInitialDataResult extends TData
              ? TDefined
              : TUndefined
          : TUndefined
    : TUndefined

// Infer TData and TError from query options
// Shared type between the results with and without the combine function
type InferDataAndError<T> =
  // Part 1: explicit type parameter as object { queryFnData, error, data }
  T extends { queryFnData: any; error?: infer TError; data: infer TData }
    ? { data: TData; error: TError }
    : T extends { queryFnData: infer TQueryFnData; error?: infer TError }
      ? { data: TQueryFnData; error: TError }
      : T extends { data: infer TData; error?: infer TError }
        ? { data: TData; error: TError }
        : // Part 2: explicit type parameter as tuple [TQueryFnData, TError, TData]
          T extends [any, infer TError, infer TData]
          ? { data: TData; error: TError }
          : T extends [infer TQueryFnData, infer TError]
            ? { data: TQueryFnData; error: TError }
            : T extends [infer TQueryFnData]
              ? { data: TQueryFnData; error: unknown }
              : // Part 3: infer from queryFn, select, throwOnError
                T extends {
                    queryFn?:
                      | QueryFunction<infer TQueryFnData, any>
                      | SkipTokenForCreateQueries
                    select?: (data: any) => infer TData
                    throwOnError?: ThrowOnError<any, infer TError, any, any>
                  }
                ? {
                    data: unknown extends TData ? TQueryFnData : TData
                    error: unknown extends TError ? DefaultError : TError
                  }
                : // Fallback
                  { data: unknown; error: DefaultError }

// Maps query options to Angular's signal-wrapped CreateQueryResult
type GetCreateQueryResult<T> = GenericGetDefinedOrUndefinedQueryResult<
  T,
  InferDataAndError<T>['data'],
  CreateQueryResult<
    InferDataAndError<T>['data'],
    InferDataAndError<T>['error']
  >,
  DefinedCreateQueryResult<
    InferDataAndError<T>['data'],
    InferDataAndError<T>['error']
  >
>

// Maps query options to plain QueryObserverResult for combine function
type GetQueryObserverResult<T> = GenericGetDefinedOrUndefinedQueryResult<
  T,
  InferDataAndError<T>['data'],
  QueryObserverResult<
    InferDataAndError<T>['data'],
    InferDataAndError<T>['error']
  >,
  DefinedQueryObserverResult<
    InferDataAndError<T>['data'],
    InferDataAndError<T>['error']
  >
>

/**
 * QueriesOptions reducer recursively unwraps function arguments to infer/enforce type param
 */
export type QueriesOptions<
  T extends Array<any>,
  TResults extends Array<any> = [],
  TDepth extends ReadonlyArray<number> = [],
> = TDepth['length'] extends MAXIMUM_DEPTH
  ? Array<QueryObserverOptionsForCreateQueries>
  : T extends []
    ? []
    : T extends [infer Head]
      ? [...TResults, GetCreateQueryOptionsForCreateQueries<Head>]
      : T extends [infer Head, ...infer Tails]
        ? QueriesOptions<
            [...Tails],
            [...TResults, GetCreateQueryOptionsForCreateQueries<Head>],
            [...TDepth, 1]
          >
        : ReadonlyArray<unknown> extends T
          ? T
          : // If T is *some* array but we couldn't assign unknown[] to it, then it must hold some known/homogenous type!
            // use this to infer the param types in the case of Array.map() argument
            T extends Array<
                QueryObserverOptionsForCreateQueries<
                  infer TQueryFnData,
                  infer TError,
                  infer TData,
                  infer TQueryKey
                >
              >
            ? Array<
                QueryObserverOptionsForCreateQueries<
                  TQueryFnData,
                  TError,
                  TData,
                  TQueryKey
                >
              >
            : // Fallback
              Array<QueryObserverOptionsForCreateQueries>

/**
 * QueriesResults reducer recursively maps type param to results
 */
export type QueriesResults<
  T extends Array<any>,
  TResults extends Array<any> = [],
  TDepth extends ReadonlyArray<number> = [],
> = TDepth['length'] extends MAXIMUM_DEPTH
  ? Array<CreateQueryResult>
  : T extends []
    ? []
    : T extends [infer Head]
      ? [...TResults, GetCreateQueryResult<Head>]
      : T extends [infer Head, ...infer Tails]
        ? QueriesResults<
            [...Tails],
            [...TResults, GetCreateQueryResult<Head>],
            [...TDepth, 1]
          >
        : { [K in keyof T]: GetCreateQueryResult<T[K]> }

// Maps query options array to plain QueryObserverResult types for combine function
type RawQueriesResults<
  T extends Array<any>,
  TResults extends Array<any> = [],
  TDepth extends ReadonlyArray<number> = [],
> = TDepth['length'] extends MAXIMUM_DEPTH
  ? Array<QueryObserverResult>
  : T extends []
    ? []
    : T extends [infer Head]
      ? [...TResults, GetQueryObserverResult<Head>]
      : T extends [infer Head, ...infer Tails]
        ? RawQueriesResults<
            [...Tails],
            [...TResults, GetQueryObserverResult<Head>],
            [...TDepth, 1]
          >
        : { [K in keyof T]: GetQueryObserverResult<T[K]> }

export interface InjectQueriesOptions<
  T extends Array<any>,
  TCombinedResult = QueriesResults<T>,
> {
  queries:
    | readonly [...QueriesOptions<T>]
    | readonly [
        ...{ [K in keyof T]: GetCreateQueryOptionsForCreateQueries<T[K]> },
      ]
  combine?: (result: RawQueriesResults<T>) => TCombinedResult
}

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
  const lifecycle = injectPendingTasksLifecycle()

  /**
   * Signal that has the default options from query client applied
   * computed() is used so signals can be inserted into the options
   * making it reactive. Wrapping options in a function ensures embedded expressions
   * are preserved and can keep being applied after signal changes
   */
  const optionsSignal = computed(() => {
    return optionsFn()
  })

  const defaultedQueries = computed(() => {
    return optionsSignal().queries.map((opts) => {
      const defaultedOptions = queryClient.defaultQueryOptions(
        opts as QueryObserverOptions,
      )
      // Make sure the results are already in fetching state before subscribing or updating options
      defaultedOptions._optimisticResults = isRestoring()
        ? 'isRestoring'
        : 'optimistic'

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

  const autoTrackResultProperties = (result: QueryObserverResult) => {
    for (const key of Object.keys(result) as Array<keyof QueryObserverResult>) {
      if (key === 'promise') continue
      const value = result[key]
      if (typeof value === 'function') continue
      // Access value once so QueryObserver knows this prop is tracked.
      void value
    }
  }

  const lazyObserver = injectLazyValue(
    () =>
      new QueriesObserver<TCombinedResult>(
        queryClient,
        defaultedQueries(),
        observerOptionsSignal(),
      ),
    () => {
      let unsubscribe: CleanupFn | undefined

      const syncSubscription = (shouldSubscribe: boolean) => {
        if (shouldSubscribe && !unsubscribe) {
          unsubscribe = ngZone.runOutsideAngular(() => subscribeToObserver())
        } else if (!shouldSubscribe && unsubscribe) {
          unsubscribe()
          unsubscribe = undefined
          lifecycle.setPending(false)
        }
      }

      syncSubscription(!untracked(isRestoring))

      const activeEffect = effect(() => {
        const shouldSubscribe = !isRestoring()

        untracked(() => {
          syncSubscription(shouldSubscribe)
        })
      })

      return () => {
        activeEffect.destroy()
        syncSubscription(false)
      }
    },
  )

  const getOptimisticResult = () => {
    const observer = lazyObserver()
    const queries = defaultedQueries()
    const combine = observerOptionsSignal().combine
    const [optimisticResult, getCombinedResult, trackResult] =
      observer.getOptimisticResult(queries, combine)
    const trackedResult = trackResult()

    if (!combine) {
      trackedResult.forEach((result, index) => {
        if (!queries[index]?.notifyOnChangeProps) {
          autoTrackResultProperties(result)
        }
      })
    }

    return {
      optimisticResult,
      combinedResult: getCombinedResult(trackedResult),
    }
  }

  const subscribeToObserver = () => {
    const observer = lazyObserver()
    const { optimisticResult } = getOptimisticResult()
    lifecycle.setPending(shouldBlockPendingTasks(observer, optimisticResult))

    return observer.subscribe((state) => {
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

      ngZone.run(() => {
        resultSignal.set(getOptimisticResult().combinedResult)
      })
    })
  }

  // Do not notify on updates because of changes in the options because
  // these changes should already be reflected in the optimistic result.
  effect(() => {
    lazyObserver().setQueries(defaultedQueries(), observerOptionsSignal())
  })

  const optimisticResultSourceSignal = computed(() => {
    const options = observerOptionsSignal()
    return { queries: defaultedQueries(), combine: options.combine }
  })

  const resultSignal = linkedSignal({
    source: optimisticResultSourceSignal,
    computation: () => getOptimisticResult().combinedResult,
  })

  // Angular does not use reactive getters on plain objects, so we wrap each
  // QueryObserverResult in a signal-backed proxy to keep field-level tracking
  // (`result.data()`, `result.status()`, etc.).
  // Solid uses a related proxy approach in useQueries, but there it proxies
  // object fields for store/resource reactivity rather than callable signals.
  const createResultProxy = (index: number) => {
    const resultAtIndexSignal = computed(
      () => (resultSignal() as Array<QueryObserverResult>)[index]!,
    )
    return signalProxy(resultAtIndexSignal, methodsToExclude)
  }

  // Keep this positional to match QueriesObserver semantics.
  // Like Solid/Vue adapters, proxies are rebuilt from current observer output.
  const proxiedResultsSignal = computed(() =>
    (resultSignal() as Array<QueryObserverResult>).map((_, index) =>
      createResultProxy(index),
    ),
  )

  return computed(() => {
    const result = resultSignal()
    const { combine } = optionsSignal()

    if (combine) {
      return result
    }

    return proxiedResultsSignal() as unknown as TCombinedResult
  }) as unknown as Signal<TCombinedResult>
}
