import { isPlatformBrowser } from '@angular/common'
import {
  PLATFORM_ID,
  TransferState,
  inject,
  provideEnvironmentInitializer,
  signal,
} from '@angular/core'
import { QueryClient, hydrate } from '@tanstack/query-core'
import { TANSTACK_QUERY_HYDRATION_STATE_KEY } from './hydration-state-key'
import { provideIsRestoring } from './inject-is-restoring'
import { queryFeature } from './providers'
import type { HydrationFeature } from './providers'

/**
 * Hydrates the {@link QueryClient} in the browser.
 * Use `provideServerTanStackQueryHydration` from `@benjavicente/angular-query-experimental/server`
 * in your server config to serialize the query cache for dehydration.
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
      const dehydratedState = transferState.get(
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
