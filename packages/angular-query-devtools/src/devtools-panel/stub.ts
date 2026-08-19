import { noop } from '@tanstack/query-core'
import type {
  DevtoolsPanelOptions,
  DevtoolsPanelRef,
  InjectDevtoolsPanel,
  InjectDevtoolsPanelOptions,
} from './types'

// Stub which replaces `injectDevtoolsPanel` in production builds
export const injectDevtoolsPanel: InjectDevtoolsPanel = () => ({
  destroy: noop,
})

export type {
  InjectDevtoolsPanel,
  DevtoolsPanelOptions,
  InjectDevtoolsPanelOptions,
  DevtoolsPanelRef,
}
