import { makeStateKey } from '@angular/core'
import type { DehydratedState } from '@tanstack/query-core'

export const TANSTACK_QUERY_HYDRATION_STATE_KEY =
  makeStateKey<DehydratedState>('tanstack-query-hydration-state')
