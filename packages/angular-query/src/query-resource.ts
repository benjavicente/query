import { computed } from '@angular/core'
import type {
  Resource,
  ResourceStatus,
  Signal,
  WritableResource,
} from '@angular/core'
import type { QueryObserverResult } from '@tanstack/query-core'

export type QueryResource<TData> = Resource<TData | undefined> &
  Pick<WritableResource<TData | undefined>, 'reload'>

export type QueryResourceAdapter<TData = unknown> = {
  resource: QueryResource<TData>
}

export type QueryObserverResourceResult<TData, TError> =
  QueryObserverResult<TData, TError> & QueryResourceAdapter<TData>

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

  const hasValue = (() =>
    status() !== 'error' &&
    resultSignal().data !== undefined) as QueryResource<TData>['hasValue']

  return {
    value,
    status,
    error,
    isLoading: computed(() => {
      const currentStatus = status()
      return currentStatus === 'loading' || currentStatus === 'reloading'
    }),
    hasValue,
    reload(): boolean {
      const currentStatus = status()
      if (currentStatus === 'idle' || currentStatus === 'loading') {
        return false
      }

      void resultSignal().refetch()
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
