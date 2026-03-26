import { makeStateKey } from '@angular/core'
import type { DehydratedState } from '@tanstack/angular-query-experimental'

/**
 * {@link https://angular.dev/api/core/makeStateKey|State key} for TanStack Query dehydrated cache in {@link https://angular.dev/api/core/TransferState|TransferState}.
 */
export const TANSTACK_QUERY_HYDRATION_STATE_KEY =
  makeStateKey<DehydratedState>('tanstack_query_hydration')
