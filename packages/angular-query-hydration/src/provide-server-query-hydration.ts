import { isPlatformServer } from '@angular/common'
import {
  PLATFORM_ID,
  TransferState,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core'
import { QueryClient, dehydrate } from '@tanstack/angular-query-experimental'
import { TANSTACK_QUERY_HYDRATION_STATE_KEY } from './hydration-state-key'
import type { EnvironmentProviders } from '@angular/core'

/**
 * Serializes the state with {@link TransferState} to provide the dehydrated state to the client.
 * @public
 */
export function provideServerQueryHydration(): EnvironmentProviders {
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
