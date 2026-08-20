import { InfiniteQueryObserver } from '@tanstack/query-core'
import { assertInInjectionContext } from '@angular/core'
import { injectBaseQuery } from './inject-base-query'
import type {
  DefaultError,
  InfiniteData,
  QueryKey,
  QueryObserver,
} from '@tanstack/query-core'
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
  injectInfiniteQueryFn: () => DefinedInitialDataInfiniteOptions<
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
  injectInfiniteQueryFn: () => UndefinedInitialDataInfiniteOptions<
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
  injectInfiniteQueryFn: () => CreateInfiniteQueryOptions<
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
 * @param injectInfiniteQueryFn - A function that returns infinite query options.
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
  injectInfiniteQueryFn: () =>
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
  return injectBaseQuery(
    injectInfiniteQueryFn,
    InfiniteQueryObserver as typeof QueryObserver,
    methodsToExclude,
  ) as unknown as
    | DefinedCreateInfiniteQueryResult<TData, TError>
    | CreateInfiniteQueryResult<TData, TError>
}

const methodsToExclude = [
  'fetchNextPage',
  'fetchPreviousPage',
  'refetch',
] as const
