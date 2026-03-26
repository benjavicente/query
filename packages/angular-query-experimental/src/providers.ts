import { DestroyRef, InjectionToken } from '@angular/core'
import { QueryClient } from '@tanstack/query-core'
import type { EnvironmentProviders, Provider } from '@angular/core'

/**
 * Usually {@link provideTanStackQuery} is used once to set up TanStack Query and the
 * {@link https://tanstack.com/query/latest/docs/reference/QueryClient|QueryClient}
 * for the entire application. Internally it calls `provideQueryClient`.
 * You can use `provideQueryClient` to provide a different `QueryClient` instance for a part
 * of the application or for unit testing purposes.
 * @param queryClient - A `QueryClient` instance, or an `InjectionToken` which provides a `QueryClient`.
 * @returns a provider object that can be used to provide the `QueryClient` instance.
 */
export function provideQueryClient(
  queryClient: QueryClient | InjectionToken<QueryClient>,
): Provider {
  if (queryClient instanceof InjectionToken) {
    return {
      provide: QueryClient,
      useFactory: (client: QueryClient, destroyRef: DestroyRef) => {
        destroyRef.onDestroy(() => client.unmount())
        client.mount()
        return client
      },
      deps: [queryClient, DestroyRef],
    }
  }

  return {
    provide: QueryClient,
    useFactory: (destroyRef: DestroyRef) => {
      const client = queryClient
      destroyRef.onDestroy(() => client.unmount())
      client.mount()
      return client
    },
    deps: [DestroyRef],
  }
}

/**
 * Sets up providers necessary to enable TanStack Query functionality for Angular applications.
 *
 * Allows to configure a `QueryClient` and optional features such as developer tools.
 *
 * **Example - standalone**
 *
 * ```ts
 * import {
 *   provideTanStackQuery,
 *   QueryClient,
 * } from '@benjavicente/angular-query-experimental'
 *
 * bootstrapApplication(AppComponent, {
 *   providers: [provideTanStackQuery(new QueryClient())],
 * })
 * ```
 *
 * **Example - NgModule-based**
 *
 * ```ts
 * import {
 *   provideTanStackQuery,
 *   QueryClient,
 * } from '@benjavicente/angular-query-experimental'
 *
 * @NgModule({
 *   declarations: [AppComponent],
 *   imports: [BrowserModule],
 *   providers: [provideTanStackQuery(new QueryClient())],
 *   bootstrap: [AppComponent],
 * })
 * export class AppModule {}
 * ```
 *
 * You can also enable optional developer tools by adding `withDevtools` from
 * `@benjavicente/angular-query-devtools`. That package uses conditional exports: optimized builds
 * typically resolve a no-op stub, while dev servers resolve the real implementation (see the
 * Angular Devtools guide). When the real implementation runs, devtools mount when `loadDevtools` is
 * omitted, true, or `'auto'` and `isDevMode()` is true.
 * ```ts
 * import { provideTanStackQuery, QueryClient } from '@benjavicente/angular-query-experimental'
 * import { withDevtools } from '@benjavicente/angular-query-devtools'
 *
 * bootstrapApplication(AppComponent, {
 *   providers: [provideTanStackQuery(new QueryClient(), withDevtools())],
 * })
 * ```
 *
 * **Example: using an InjectionToken**
 *
 * ```ts
 * export const MY_QUERY_CLIENT = new InjectionToken('', {
 *   factory: () => new QueryClient(),
 * })
 *
 * // In a lazy loaded route or lazy loaded component's providers array:
 * providers: [provideTanStackQuery(MY_QUERY_CLIENT)]
 * ```
 * Using an InjectionToken for the QueryClient is an advanced optimization which allows TanStack Query to be absent from the main application bundle.
 * This can be beneficial if you want to include TanStack Query on lazy loaded routes only while still sharing a `QueryClient`.
 *
 * Note that this is a small optimization and for most applications it's preferable to provide the `QueryClient` in the main application config.
 * @param queryClient - A `QueryClient` instance, or an `InjectionToken` which provides a `QueryClient`.
 * @param features - Optional features to configure additional Query functionality.
 * @returns A set of providers to set up TanStack Query.
 * @see https://tanstack.com/query/v5/docs/framework/angular/quick-start
 * @see https://tanstack.com/query/v5/docs/framework/angular/devtools
 * @see https://tanstack.com/query/latest/docs/framework/angular/guides/ssr
 */
export function provideTanStackQuery(
  queryClient: QueryClient | InjectionToken<QueryClient>,
  ...features: Array<QueryFeatures>
): Array<Provider | EnvironmentProviders> {
  return [
    provideQueryClient(queryClient),
    ...features.flatMap((feature) => feature.ɵproviders),
  ]
}

type QueryFeatureKind = "Devtools" | "Hydration" | "PersistQueryClient"

/**
 * Helper type to represent a Query feature.
 */
export interface QueryFeature<TFeatureKind extends QueryFeatureKind> {
  ɵkind: TFeatureKind
  ɵproviders: Array<Provider | EnvironmentProviders>
}

/**
 * Helper function to create an object that represents a Query feature.
 * @param kind - The feature kind identifier.
 * @param providers - The providers contributed by the feature.
 * @returns A Query feature.
 */
export function queryFeature<TFeatureKind extends QueryFeatureKind>(
  kind: TFeatureKind,
  providers: Array<Provider | EnvironmentProviders>,
): QueryFeature<TFeatureKind> {
  return { ɵkind: kind, ɵproviders: providers }
}

/**
 * A type alias that represents a feature which enables developer tools.
 * The type is used to describe the return value of the `withDevtools` function.
 * @see {@link withDevtools}
 */
export type DevtoolsFeature = QueryFeature<'Devtools'>

/**
 * A type alias that represents a feature which enables persistence.
 * The type is used to describe the return value of the `withPersistQueryClient` function.
 */
export type PersistQueryClientFeature = QueryFeature<'PersistQueryClient'>

/**
 * A type alias that represents a feature which enables SSR dehydrate / client hydrate via TransferState.
 * The type is used to describe the return value of the `withHydration` function.
 */
export type HydrationFeature = QueryFeature<'Hydration'>

/**
 * A type alias that represents all Query features available for use with `provideTanStackQuery`.
 * Features can be enabled by adding special functions to the `provideTanStackQuery` call.
 * See documentation for each symbol to find corresponding function name. See also `provideTanStackQuery`
 * documentation on how to use those functions.
 * @see {@link provideTanStackQuery}
 */
export type QueryFeatures =
  | DevtoolsFeature
  | HydrationFeature
  | PersistQueryClientFeature
