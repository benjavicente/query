import type {
  DefaultError,
  InfiniteQueryObserverPendingResult,
  QueryObserverPendingResult,
} from './types'

/**
 * Sentinel value that can be passed instead of the whole options object to skip a query entirely.
 *
 * Unlike `enabled: false` or `queryFn: skipToken`, a skipped query has no `queryKey`, so it never
 * builds or observes a `Query` in the cache, never shows up in the devtools, and can't be refetched.
 * The hook returns the same static, idle `pending` result every time instead (see
 * {@link getSkippedQueryResult}).
 *
 * Switching from options to `skipQuery` and back starts from scratch, so `placeholderData` does
 * not receive the data of the query observed before skipping.
 * @example
 * ```ts
 * const query = useQuery(postId != null ? postOptions(postId) : skipQuery)
 * ```
 */
export const skipQuery = Symbol()
/**
 * The type of the {@link skipQuery} sentinel value.
 */
export type SkipQuery = typeof skipQuery

function warnSkipped(method: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error(
      `${method}() was called on a query skipped with skipQuery. A skipped query has no queryKey or queryFn, so there is nothing to fetch.`,
    )
  }
}

const skippedQueryResult: QueryObserverPendingResult<any, any> = {
  status: 'pending',
  fetchStatus: 'idle',
  isPending: true,
  isSuccess: false,
  isError: false,
  isInitialLoading: false,
  isLoading: false,
  data: undefined,
  dataUpdatedAt: 0,
  error: null,
  errorUpdatedAt: 0,
  failureCount: 0,
  failureReason: null,
  errorUpdateCount: 0,
  isFetched: false,
  isFetchedAfterMount: false,
  isFetching: false,
  isRefetching: false,
  isLoadingError: false,
  isPaused: false,
  isPlaceholderData: false,
  isRefetchError: false,
  isStale: false,
  isEnabled: false,
  refetch: () => {
    warnSkipped('refetch')
    return Promise.resolve(skippedQueryResult)
  },
}

const skippedInfiniteQueryResult: InfiniteQueryObserverPendingResult<
  any,
  any
> = {
  ...skippedQueryResult,
  refetch: () => {
    warnSkipped('refetch')
    return Promise.resolve(skippedInfiniteQueryResult)
  },
  fetchNextPage: () => {
    warnSkipped('fetchNextPage')
    return Promise.resolve(skippedInfiniteQueryResult)
  },
  fetchPreviousPage: () => {
    warnSkipped('fetchPreviousPage')
    return Promise.resolve(skippedInfiniteQueryResult)
  },
  hasNextPage: false,
  hasPreviousPage: false,
  isFetchNextPageError: false,
  isFetchingNextPage: false,
  isFetchPreviousPageError: false,
  isFetchingPreviousPage: false,
}

/**
 * Returns the result of a query skipped with {@link skipQuery}: an idle `pending` result without
 * data. The same object is returned on every call, so it is referentially stable. Its `refetch`
 * does nothing and resolves with the same result.
 * @returns The static skipped result.
 */
export function getSkippedQueryResult<
  TData = unknown,
  TError = DefaultError,
>(): QueryObserverPendingResult<TData, TError> {
  return skippedQueryResult
}

/**
 * The infinite query counterpart of {@link getSkippedQueryResult}. `hasNextPage` and
 * `hasPreviousPage` are `false`, and `fetchNextPage` and `fetchPreviousPage` do nothing.
 * @returns The static skipped infinite result.
 */
export function getSkippedInfiniteQueryResult<
  TData = unknown,
  TError = DefaultError,
>(): InfiniteQueryObserverPendingResult<TData, TError> {
  return skippedInfiniteQueryResult
}
