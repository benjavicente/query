import { InfiniteQueryObserver } from '@tanstack/query-core'
import { assertInInjectionContext, untracked } from '@angular/core'
import { injectBaseQuery } from './inject-base-query'
import { signalProxy } from './utils/signal-proxy'
import { infiniteQueryResultFields } from './utils/result-fields'
import type {
  DefaultError,
  FetchNextPageOptions,
  FetchPreviousPageOptions,
  InfiniteData,
  InfiniteQueryObserverResult,
  QueryKey,
  QueryObserver,
  RefetchOptions,
} from '@tanstack/query-core'
import type { Signal } from '@angular/core'
import type {
  CreateInfiniteQueryOptions,
  CreateInfiniteQueryResult,
  DefinedCreateInfiniteQueryResult,
} from './types'
import type {
  DefinedInitialDataInfiniteOptions,
  UndefinedInitialDataInfiniteOptions,
} from './infinite-query-options'

export function injectInfiniteQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = InfiniteData<TQueryFnData>,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
>(
  optionsFn: () => DefinedInitialDataInfiniteOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey,
    TPageParam
  >,
): DefinedCreateInfiniteQueryResult<TData, TError>

export function injectInfiniteQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = InfiniteData<TQueryFnData>,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
>(
  optionsFn: () => UndefinedInitialDataInfiniteOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey,
    TPageParam
  >,
): CreateInfiniteQueryResult<TData, TError>

export function injectInfiniteQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = InfiniteData<TQueryFnData>,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
>(
  optionsFn: () => CreateInfiniteQueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey,
    TPageParam
  >,
): CreateInfiniteQueryResult<TData, TError>

/**
 * Injects an infinite query: a declarative dependency on an asynchronous source of data that is tied to a unique key.
 * Infinite queries can additively "load more" data onto an existing set of data or support infinite scroll.
 *
 * @param optionsFn - A function that returns infinite query options.
 * @returns The infinite query result.
 * @see https://tanstack.com/query/latest/docs/framework/angular/guides/infinite-queries
 */
export function injectInfiniteQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = InfiniteData<TQueryFnData>,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
>(
  optionsFn: () =>
    | DefinedInitialDataInfiniteOptions<
        TQueryFnData,
        TError,
        TData,
        TQueryKey,
        TPageParam
      >
    | CreateInfiniteQueryOptions<
        TQueryFnData,
        TError,
        TData,
        TQueryKey,
        TPageParam
      >,
):
  | DefinedCreateInfiniteQueryResult<TData, TError>
  | CreateInfiniteQueryResult<TData, TError> {
  assertInInjectionContext(injectInfiniteQuery)
  const { resultSignal, getObserver } = injectBaseQuery(
    optionsFn,
    InfiniteQueryObserver as typeof QueryObserver,
  )
  const getInfiniteObserver = () =>
    getObserver() as InfiniteQueryObserver<
      TQueryFnData,
      TError,
      TData,
      TQueryKey,
      TPageParam
    >
  return Object.assign(
    signalProxy(
      resultSignal as Signal<InfiniteQueryObserverResult<TData, TError>>,
      infiniteQueryResultFields,
    ),
    {
      refetch: (options?: RefetchOptions) =>
        untracked(() => getInfiniteObserver().refetch(options)),
      fetchNextPage: (options?: FetchNextPageOptions) =>
        untracked(() => getInfiniteObserver().fetchNextPage(options)),
      fetchPreviousPage: (options?: FetchPreviousPageOptions) =>
        untracked(() => getInfiniteObserver().fetchPreviousPage(options)),
    },
  ) as unknown as
    | DefinedCreateInfiniteQueryResult<TData, TError>
    | CreateInfiniteQueryResult<TData, TError>
}
