import type { PersistQueryClientOptions as PersistQueryClientOptionsCore } from '@tanstack/query-persist-client-core'

export type PersistQueryClientUserOptions = {
  persistOptions: Omit<PersistQueryClientOptionsCore, 'queryClient'>
  onSuccess?: () => Promise<unknown> | unknown
  onError?: () => Promise<unknown> | unknown
}

/**
 * Returns persistence options. The function runs once in an Angular injection
 * context in the browser, so it can call `inject()` and touch browser APIs.
 */
export type WithPersistQueryClientFn = () => PersistQueryClientUserOptions
