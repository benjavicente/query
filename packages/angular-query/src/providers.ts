import { isPlatformBrowser, isPlatformServer } from '@angular/common'
import {
  DOCUMENT,
  DestroyRef,
  InjectionToken,
  PLATFORM_ID,
  TransferState,
  inject,
  makeEnvironmentProviders,
  makeStateKey,
  provideEnvironmentInitializer,
} from '@angular/core'
import { QueryClient, dehydrate, hydrate } from '@tanstack/query-core'
import { INTERNAL_TANSTACK_QUERY_HYDRATION_TRANSFER_KEY } from './hydration-state-key'
import type { DehydratedState } from '@tanstack/query-core'
import type { EnvironmentProviders, Provider } from '@angular/core'

const INTERNAL_QUERY_CLIENT_SHOULD_HYDRATE = new InjectionToken<boolean>('', {
  providedIn: 'root',
  factory: () => true,
})

function configureQueryClient() {
  const queryClient = inject(QueryClient)
  const destroyRef = inject(DestroyRef)
  const platformId = inject(PLATFORM_ID)
  const shouldHydrate = inject(INTERNAL_QUERY_CLIENT_SHOULD_HYDRATE)
  const hydrationStateKey = inject(
    INTERNAL_TANSTACK_QUERY_HYDRATION_TRANSFER_KEY,
  )

  if (inject(DOCUMENT, { optional: true })) {
    const transferState = inject(TransferState)

    if (shouldHydrate && isPlatformServer(platformId)) {
      transferState.onSerialize(hydrationStateKey, () => dehydrate(queryClient))
    } else if (shouldHydrate && isPlatformBrowser(platformId)) {
      const dehydratedState = transferState.get(hydrationStateKey, null)
      if (dehydratedState) {
        hydrate(queryClient, dehydratedState)
        transferState.remove(hydrationStateKey)
      }
    }
  }

  queryClient.mount()
  destroyRef.onDestroy(() => queryClient.unmount())
}

function createQueryClientProvider(
  queryClientFactoryOrToken: InjectionToken<QueryClient> | (() => QueryClient),
): Provider {
  return queryClientFactoryOrToken instanceof InjectionToken
    ? { provide: QueryClient, useExisting: queryClientFactoryOrToken }
    : { provide: QueryClient, useFactory: queryClientFactoryOrToken }
}

/**
 * Provides a `QueryClient` and optional TanStack Query features.
 * The factory runs once per injector in Angular's injection context, so it can
 * call `inject()` and each SSR request can receive an independent cache.
 *
 * **Example - standalone**
 *
 * ```ts
 * import {
 *   provideTanStackQuery,
 *   QueryClient,
 * } from '@tanstack/angular-query'
 *
 * bootstrapApplication(AppComponent, {
 *   providers: [provideTanStackQuery(() => new QueryClient())],
 * })
 * ```
 *
 * You can also enable optional developer tools by adding `withDevtools`. By
 * default the tools will then be loaded when your app is in development mode.
 *
 * ```ts
 * import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query'
 * import { withDevtools } from '@tanstack/angular-query-devtools'
 *
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideTanStackQuery(() => new QueryClient(), withDevtools()),
 *   ],
 * })
 * ```
 *
 * Use an `InjectionToken` when another provider owns client creation:
 *
 * ```ts
 * export const MY_QUERY_CLIENT = new InjectionToken('', {
 *   factory: () => new QueryClient(),
 * })
 *
 * providers: [provideTanStackQuery(MY_QUERY_CLIENT)]
 * ```
 *
 * @param queryClientFactoryOrToken - A `QueryClient` factory or an `InjectionToken` that resolves one.
 * @param features - Optional features to configure additional Query functionality.
 * @returns A single {@link EnvironmentProviders} value (do not spread into `providers`).
 * @see https://tanstack.com/query/v5/docs/framework/angular/quick-start
 * @see https://tanstack.com/query/v5/docs/framework/angular/devtools
 * @see https://tanstack.com/query/latest/docs/framework/angular/guides/ssr
 */
export function provideTanStackQuery(
  queryClientFactoryOrToken: InjectionToken<QueryClient> | (() => QueryClient),
  ...features: ReadonlyArray<QueryFeature>
): EnvironmentProviders {
  return makeEnvironmentProviders([
    createQueryClientProvider(queryClientFactoryOrToken),
    ...features.map(getQueryFeatureProviders),
    provideEnvironmentInitializer(configureQueryClient),
  ])
}

const queryFeatureBrand: unique symbol = Symbol('QueryFeature')

/**
 * Helper type to represent a Query feature.
 */
export interface QueryFeature {
  readonly [queryFeatureBrand]: true
}

interface InternalQueryFeature extends QueryFeature {
  readonly ɵproviders: EnvironmentProviders
}

/**
 * Helper function to create an object that represents a Query feature.
 * @param providers -
 * @returns A Query feature.
 */
export function queryFeature(providers: EnvironmentProviders): QueryFeature {
  const feature: InternalQueryFeature = {
    [queryFeatureBrand]: true,
    ɵproviders: providers,
  }

  return feature
}

export function getQueryFeatureProviders(
  feature: QueryFeature,
): EnvironmentProviders {
  return (feature as InternalQueryFeature).ɵproviders
}

/**
 * Sets a non-default serialization key for this injector's `QueryClient` cache (server dehydrate /
 * browser hydrate via `TransferState`). Use this when you have multiple `QueryClient` instances
 * so each has its own key. The default key applies when you do not add this feature.
 *
 * ```ts
 * providers: [
 *   provideTanStackQuery(
 *     () => new QueryClient(),
 *     withHydrationKey('my-secondary-query-cache'),
 *   ),
 * ]
 * ```
 *
 * @param key - A unique string for this client's `TransferState` entry.
 */
export function withHydrationKey(key: string): QueryFeature {
  return queryFeature(
    makeEnvironmentProviders([
      {
        provide: INTERNAL_TANSTACK_QUERY_HYDRATION_TRANSFER_KEY,
        useValue: makeStateKey<DehydratedState>(key),
      },
    ]),
  )
}

/**
 * Disables `TransferState` hydration and dehydration for the current environment injector.
 */
export function withNoQueryHydration(): QueryFeature {
  return queryFeature(
    makeEnvironmentProviders([
      {
        provide: INTERNAL_QUERY_CLIENT_SHOULD_HYDRATE,
        useValue: false,
      },
    ]),
  )
}
