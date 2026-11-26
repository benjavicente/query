'use client'
import { shouldThrowError } from '@tanstack/query-core'
import * as React from 'react'
import type {
  DefaultError,
  DefaultedQueryObserverOptions,
  Query,
  QueryKey,
  QueryObserverResult,
  ThrowOnError,
} from '@tanstack/query-core'
import type { QueryErrorResetBoundaryValue } from './QueryErrorResetBoundary'

/**
 * The defaulted options of a query read by a hook, with the hook's `throwOnError` option.
 */
export type DefaultedUseQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = DefaultedQueryObserverOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryData,
  TQueryKey
> & {
  throwOnError?: ThrowOnError<TQueryFnData, TError, TQueryData, TQueryKey>
}

/**
 * Turns off `retryOnMount` for a query that throws its errors (with `suspense` or `throwOnError`),
 * unless the error boundary has been reset, so a remount doesn't retry the failed query before the
 * user resets the boundary. A Suspense query whose error reaches the boundary is also disabled, so
 * switching to it doesn't refetch it before the boundary resets. Mutates the options.
 * @param options - The defaulted query options to adjust.
 * @param errorResetBoundary - The value of the nearest `QueryErrorResetBoundary`.
 * @param query - The query, used to evaluate a `throwOnError` function against its error.
 * @param suspense - Whether the query is read by a Suspense hook.
 */
export const ensurePreventErrorBoundaryRetry = <
  TQueryFnData,
  TError,
  TData,
  TQueryData,
  TQueryKey extends QueryKey,
>(
  options: DefaultedUseQueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
  errorResetBoundary: QueryErrorResetBoundaryValue,
  query: Query<TQueryFnData, TError, TQueryData, TQueryKey> | undefined,
  suspense: boolean,
) => {
  const throwOnError =
    query?.state.status === 'error' &&
    typeof options.throwOnError === 'function'
      ? shouldThrowError(options.throwOnError, [
          query.state.error as TError,
          query,
        ])
      : options.throwOnError

  if ((suspense || throwOnError) && !errorResetBoundary.isReset()) {
    // Prevent retrying failed query if the error boundary has not been reset yet
    options.retryOnMount = false

    // Keep the error in place until the boundary resets, instead of refetching the query when the
    // component switches to it (#2434)
    if (
      suspense &&
      query?.state.status === 'error' &&
      (query.state.data === undefined || throwOnError)
    ) {
      options.enabled = false
    }
  }
}

/**
 * Clears the reset state of the error boundary after the component mounts, so later errors are
 * thrown to the boundary again.
 * @param errorResetBoundary - The value of the nearest `QueryErrorResetBoundary`.
 */
export const useClearResetErrorBoundary = (
  errorResetBoundary: QueryErrorResetBoundaryValue,
) => {
  React.useEffect(() => {
    errorResetBoundary.clearReset()
  }, [errorResetBoundary])
}

/**
 * Checks whether the query error should be thrown to the nearest error boundary: the query errored
 * and isn't fetching, the boundary hasn't been reset, and either `suspense` is enabled with no data
 * or `throwOnError` says so.
 * @param params - The observer `result`, the `errorResetBoundary`, the `throwOnError` option, the
 * `query`, and the `suspense` option.
 * @returns `true` if the error should be thrown.
 */
export const getHasError = <
  TData,
  TError,
  TQueryFnData,
  TQueryData,
  TQueryKey extends QueryKey,
>({
  result,
  errorResetBoundary,
  throwOnError,
  query,
  suspense,
}: {
  result: QueryObserverResult<TData, TError>
  errorResetBoundary: QueryErrorResetBoundaryValue
  throwOnError:
    | ThrowOnError<TQueryFnData, TError, TQueryData, TQueryKey>
    | undefined
  query: Query<TQueryFnData, TError, TQueryData, TQueryKey> | undefined
  suspense: boolean | undefined
}) => {
  return (
    result.isError &&
    !errorResetBoundary.isReset() &&
    !result.isFetching &&
    query &&
    ((suspense && result.data === undefined) ||
      shouldThrowError(throwOnError, [result.error, query]))
  )
}
