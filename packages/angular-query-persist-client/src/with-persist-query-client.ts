import { QueryClient } from '@benjavicente/angular-query'
import {
  DestroyRef,
  InjectionToken,
  PLATFORM_ID,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  signal,
} from '@angular/core'
import {
  IS_RESTORING,
  queryFeature,
} from '@benjavicente/angular-query/internal'
import { isPlatformBrowser } from '@angular/common'
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core'
import type { WritableSignal } from '@angular/core'
import type { QueryFeature } from '@benjavicente/angular-query'
import type {
  PersistQueryClientUserOptions,
  WithPersistQueryClientFn,
} from './with-persist-query-client.types'

const RESTORING_STATE = new InjectionToken<WritableSignal<boolean>>(
  'Query restoration state',
)

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
): QueryFeature
export function withPersistQueryClient(
  options: PersistQueryClientUserOptions,
): QueryFeature
/**
 * @param factoryOrOptions - Either a callback (runs only in the browser) or a static options object.
 * @returns A set of providers for use with `provideTanStackQuery`.
 * @public
 */
export function withPersistQueryClient(
  factoryOrOptions: PersistQueryClientUserOptions | WithPersistQueryClientFn,
): QueryFeature {
  return queryFeature(
    makeEnvironmentProviders([
      { provide: RESTORING_STATE, useFactory: () => signal(true) },
      {
        provide: IS_RESTORING,
        useFactory: () => inject(RESTORING_STATE).asReadonly(),
      },
      provideEnvironmentInitializer(() => {
        const isRestoring = inject(RESTORING_STATE)
        if (!isPlatformBrowser(inject(PLATFORM_ID))) {
          isRestoring.set(false)
          return
        }
        const destroyRef = inject(DestroyRef)
        const queryClient = inject(QueryClient)

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
            if (destroyRef.destroyed) return
            isRestoring.set(false)
            const cleanup = persistQueryClientSubscribe(options)
            destroyRef.onDestroy(cleanup)
          })
      }),
    ]),
  )
}
