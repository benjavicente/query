import { makeEnvironmentProviders } from '@angular/core'
import type { DevtoolsOptions, WithDevtools, WithDevtoolsFn } from './types'

// Stub which replaces `withDevtools` in production builds
export const withDevtools: WithDevtools = () => ({
  ɵkind: 'Devtools',
  ɵproviders: makeEnvironmentProviders([]),
})

export type { DevtoolsOptions, WithDevtools, WithDevtoolsFn }
