import {
  QueryClient,
  provideIsRestoring,
  queryFeature,
} from '@benjavicente/angular-query'
import {
  DestroyRef,
  PLATFORM_ID,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  signal,
} from '@angular/core'
import { isPlatformBrowser } from '@angular/common'
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core'
import type { PersistQueryClientFeature } from '@benjavicente/angular-query'
import type {
  PersistQueryClientUserOptions,
  WithPersistQueryClientFn,
} from './with-persist-query-client.types'

export type {
  PersistQueryClientUserOptions,
  WithPersistQueryClientFn,
} from './with-persist-query-client.types'

/**
 * Resolves factory vs static persistence configuration.
 * @param input - Callback or static options object.
 * @returns Resolved persistence user options for the browser initializer.
 */
function resolvePersistOptions(
  input: PersistQueryClientUserOptions | WithPersistQueryClientFn,
): PersistQueryClientUserOptions {
  return typeof input === 'function' ? input() : input
}

/**
 * Enables persistence.
 *
 * **Example (static options)** - avoid browser-only globals at module scope when the same config
 * runs on the server; prefer the factory form below for `localStorage`.
 *
 * ```ts
 * withPersistQueryClient({
 *   persistOptions: { persister },
 *   onSuccess: () => console.log('Restored.'),
 * })
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideTanStackQuery(
 *       () => new QueryClient(),
 *       withPersistQueryClient({
 *         persistOptions: {
 *           persister: localStoragePersister,
 *         },
 *         onSuccess: () => console.log('Restoration completed successfully.'),
 *       }),
 *     ),
 *   ],
 * };
 * ```
 *
 * **Example (factory, browser only)** - the callback only runs in the browser, in an
 * Angular injection context, so it can call `inject()` and reference browser APIs
 * such as `localStorage`.
 *
 * ```ts
 * withPersistQueryClient(() => ({
 *   persistOptions: {
 *     persister: createAsyncStoragePersister({ storage: localStorage }),
 *   },
 * }))
 * ```
 *
 * ```ts
 * withPersistQueryClient(() => ({
 *   persistOptions: {
 *     persister: inject(StorageService).createPersister(),
 *   },
 * }))
 * ```
 * @param factoryOrOptions - Either a callback (runs only in the browser) or a static options object.
 * @returns A set of providers for use with `provideTanStackQuery`.
 * @public
 */
export function withPersistQueryClient(
  factoryOrOptions: WithPersistQueryClientFn,
): PersistQueryClientFeature
export function withPersistQueryClient(
  options: PersistQueryClientUserOptions,
): PersistQueryClientFeature
/**
 * @param factoryOrOptions - Either a callback (runs only in the browser) or a static options object.
 * @returns A set of providers for use with `provideTanStackQuery`.
 * @public
 */
export function withPersistQueryClient(
  factoryOrOptions: PersistQueryClientUserOptions | WithPersistQueryClientFn,
): PersistQueryClientFeature {
  const isRestoring = signal(true)
  return queryFeature(
    'PersistQueryClient',
    makeEnvironmentProviders([
      provideIsRestoring(isRestoring.asReadonly()),
      provideEnvironmentInitializer(() => {
        if (!isPlatformBrowser(inject(PLATFORM_ID))) {
          isRestoring.set(false)
          return
        }
        const destroyRef = inject(DestroyRef)
        const queryClient = inject(QueryClient)
        let injectorDestroyed = false

        // Angular versions newer than our minimum expose DestroyRef.destroyed.
        // Keep a local flag so this remains compatible with Angular 20.0.
        destroyRef.onDestroy(() => {
          injectorDestroyed = true
        })

        const { onSuccess, onError, persistOptions } =
          resolvePersistOptions(factoryOrOptions)
        const options = { queryClient, ...persistOptions }
        void persistQueryClientRestore(options)
          .then(() => {
            return onSuccess?.()
          })
          .catch(() => {
            return onError?.()
          })
          .finally(() => {
            if (injectorDestroyed) return
            isRestoring.set(false)
            const cleanup = persistQueryClientSubscribe(options)
            destroyRef.onDestroy(cleanup)
          })
      }),
    ]),
  )
}
