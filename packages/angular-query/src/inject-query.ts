import { QueryObserver } from '@tanstack/query-core'
import { assertInInjectionContext } from '@angular/core'
import { injectBaseQuery } from './inject-base-query'
import type { DefaultError, QueryKey } from '@tanstack/query-core'
import type {
  CreateQueryOptions,
  CreateQueryResult,
  DefinedCreateQueryResult,
} from './types'
import type {
  DefinedInitialDataOptions,
  UndefinedInitialDataOptions,
} from './query-options'

export function injectQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  optionsFn: () => DefinedInitialDataOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey
  >,
): DefinedCreateQueryResult<TData, TError>

export function injectQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  optionsFn: () => UndefinedInitialDataOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey
  >,
): CreateQueryResult<TData, TError>

export function injectQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  optionsFn: () => CreateQueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey
  >,
): CreateQueryResult<TData, TError>

/**
 * Injects a query: a declarative dependency on an asynchronous source of data that is tied to a unique key.
 *
 * **Basic example**
 * ```ts
 * import { lastValueFrom } from 'rxjs'
 *
 * class ServiceOrComponent {
 *   query = injectQuery(() => ({
 *     queryKey: ['repoData'],
 *     queryFn: () =>
 *       lastValueFrom(
 *         this.#http.get<Response>('https://api.github.com/repos/tanstack/query'),
 *       ),
 *   }))
 * }
 * ```
 *
 * Similar to `computed` from Angular, the function passed to `injectQuery` will be run in the reactive context.
 * In the example below, the query will be automatically enabled and executed when the filter signal changes
 * to a truthy value. When the filter signal changes back to a falsy value, the query will be disabled.
 *
 * **Reactive example**
 * ```ts
 * class ServiceOrComponent {
 *   filter = signal('')
 *
 *   todosQuery = injectQuery(() => ({
 *     queryKey: ['todos', this.filter()],
 *     queryFn: () => fetchTodos(this.filter()),
 *     // Signals can be combined with expressions
 *     enabled: !!this.filter(),
 *   }))
 * }
 * ```
 * @param optionsFn - A function that returns query options.
 * @returns The query result.
 * @see https://tanstack.com/query/latest/docs/framework/angular/guides/queries
 */
export function injectQuery(
  optionsFn: () => CreateQueryOptions,
): DefinedCreateQueryResult | CreateQueryResult {
  assertInInjectionContext(injectQuery)
  return injectBaseQuery(
    optionsFn,
    QueryObserver,
    methodsToExclude,
  ) as unknown as DefinedCreateQueryResult | CreateQueryResult
}

const methodsToExclude = ['refetch'] as const
