import { computed, untracked } from '@angular/core'
import type { QueryObserverResult } from '@tanstack/query-core'
import type {
  Resource,
  ResourceSnapshot,
  ResourceStatus,
} from './resource-types'
import type { Signal } from '@angular/core'

export interface QueryResource<TData> extends Resource<TData | undefined> {
  /**
   * Requests a new query fetch only when the current query data is stale.
   *
   * Used for compatibility with Angular APIs that might want to reload a resource,
   * like Signal Forms' validateAsync resource interface.
   *
   * @returns `true` if a reload was initiated, `false` if a reload was unnecessary or unsupported.
   */
  reload: () => boolean
}

export type QueryResourceAdapter<TData = unknown> = {
  /**
   * The query result as Angular's Resource interface.
   */
  resource: QueryResource<TData>
}

export function createQueryResource<TData, TError>(
  resultSignal: Signal<QueryObserverResult<TData, TError>>,
): QueryResource<TData> {
  const status = computed<ResourceStatus>(() => {
    const result = resultSignal()

    if (result.fetchStatus === 'fetching' || result.fetchStatus === 'paused') {
      return result.data === undefined ? 'loading' : 'reloading'
    }

    switch (result.status) {
      case 'success':
        return 'resolved'
      case 'error':
        return 'error'
      case 'pending':
        return 'idle'
    }
  })

  const error = computed(() => normalizeError(resultSignal().error))

  const value = computed(() => {
    if (status() === 'error') {
      throw error()
    }

    return resultSignal().data
  })

  const snapshot = computed<ResourceSnapshot<TData | undefined>>(() => {
    const currentStatus = status()

    if (currentStatus === 'error') {
      return { status: 'error', error: error()! }
    }

    return { status: currentStatus, value: resultSignal().data }
  })

  const hasValue = (() =>
    status() !== 'error' &&
    resultSignal().data !== undefined) as QueryResource<TData>['hasValue']

  return {
    value,
    status,
    error,
    snapshot,
    isLoading: computed(() => {
      const currentStatus = status()
      return currentStatus === 'loading' || currentStatus === 'reloading'
    }),
    hasValue,
    reload(): boolean {
      const currentStatus = untracked(status)
      if (
        currentStatus === 'idle' ||
        currentStatus === 'loading' ||
        currentStatus === 'reloading'
      ) {
        return false
      }

      const result = untracked(resultSignal)
      if (!result.isStale) {
        return false
      }

      void result.refetch()
      return true
    },
  }
}

function normalizeError(error: unknown): Error | undefined {
  if (error == null) {
    return undefined
  }

  if (error instanceof Error) {
    return error
  }

  return new Error(String(error), { cause: error })
}
