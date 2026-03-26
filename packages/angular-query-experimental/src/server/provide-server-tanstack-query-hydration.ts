import { isPlatformServer } from '@angular/common'
import {
  PLATFORM_ID,
  TransferState,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core'
import { QueryClient, dehydrate } from '@tanstack/query-core'
import { TANSTACK_QUERY_HYDRATION_STATE_KEY } from '../hydration-state-key'
import type { EnvironmentProviders } from '@angular/core'

/**
 * Serializes the query cache for dehydration.
 * Use `provideServerTanStackQueryHydration` in your server config to serialize the query cache for dehydration.
 * @public
 */
export function provideServerTanStackQueryHydration(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      if (!isPlatformServer(inject(PLATFORM_ID))) {
        return
      }

      const transferState = inject(TransferState)
      const queryClient = inject(QueryClient)

      transferState.onSerialize(TANSTACK_QUERY_HYDRATION_STATE_KEY, () =>
        dehydrate(queryClient),
      )
    }),
  ])
}
