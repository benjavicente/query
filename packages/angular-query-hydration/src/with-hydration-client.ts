import { isPlatformBrowser } from '@angular/common'
import {
  PLATFORM_ID,
  TransferState,
  inject,
  provideEnvironmentInitializer,
  signal,
} from '@angular/core'
import {
  QueryClient,
  hydrate,
  provideIsRestoring,
  queryFeature,
} from '@tanstack/angular-query-experimental'
import { TANSTACK_QUERY_HYDRATION_STATE_KEY } from './hydration-state-key'
import type { DehydratedState, HydrationFeature } from '@tanstack/angular-query-experimental'

/**
 * Hydrates the {@link QueryClient} in the browser from {@link TransferState}.
 * Use `provideServerQueryHydration` from `@tanstack/angular-query-hydration/server` in your server config to dehydrate before HTML serialization.
 *
 * **Example**
 *
 * ```ts
 * // app.config.ts
 * import { withHydration } from '@tanstack/angular-query-hydration/client'
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideTanStackQuery(new QueryClient(), withHydration()),
 *   ],
 * };
 * ```
 * @returns A set of providers for use with {@link provideTanStackQuery}.
 * @public
 */
export function withHydration(): HydrationFeature {
  const isRestoring = signal(true)

  return queryFeature('Hydration', [
    provideIsRestoring(isRestoring.asReadonly()),
    provideEnvironmentInitializer(() => {
      const platformId = inject(PLATFORM_ID)
      if (!isPlatformBrowser(platformId)) {
        isRestoring.set(false)
        return
      }

      const transferState = inject(TransferState)
      const client = inject(QueryClient)
      const dehydratedState = transferState.get<DehydratedState | null>(
        TANSTACK_QUERY_HYDRATION_STATE_KEY,
        null,
      )

      if (dehydratedState) {
        hydrate(client, dehydratedState)
        transferState.remove(TANSTACK_QUERY_HYDRATION_STATE_KEY)
      }
      queueMicrotask(() => {
        isRestoring.set(false)
      })
    }),
  ])
}
