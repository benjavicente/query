// cspell:ignore zoneful
import {
  NgZone,
  provideZoneChangeDetection,
} from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  QueryClient,
  injectMutation,
  injectQueries,
  injectQuery,
  provideTanStackQuery,
} from '..'

/**
 * These tests deliberately provide Angular's zone-based scheduler directly.
 * They are run by vitest.zoneful.config.ts, whose setup also loads the Zone.js
 * testing patches. Keeping this small integration set separate avoids making
 * every signal assertion in the zoneless suite depend on Zone.js scheduling.
 */
describe('Zone.js notification integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient()
    TestBed.configureTestingModule({
      providers: [
        provideZoneChangeDetection(),
        provideTanStackQuery(() => queryClient),
      ],
    })
  })

  afterEach(() => {
    TestBed.resetTestingModule()
  })

  it('keeps an injectQuery signal current on a direct cache notification', () => {
    const key = ['zoneful-query']
    const query = TestBed.runInInjectionContext(() =>
      injectQuery(() => ({
        queryKey: key,
        enabled: false,
      })),
    )

    expect(query.data()).toBeUndefined()
    queryClient.setQueryData(key, 'updated')

    expect(query.data()).toBe('updated')
  })

  it('keeps injectQueries result notifications current in Zone.js mode', () => {
    const key = ['zoneful-queries']
    const queries = TestBed.runInInjectionContext(() =>
      injectQueries(() => ({
        queries: [{ queryKey: key, enabled: false }],
      })),
    )

    expect(queries()[0].data()).toBeUndefined()
    queryClient.setQueryData(key, 'updated')

    expect(queries()[0].data()).toBe('updated')
  })

  it('makes cache notifications visible inside mutation onMutate', async () => {
    const key = ['zoneful-optimistic']
    const query = TestBed.runInInjectionContext(() =>
      injectQuery(() => ({
        queryKey: key,
        enabled: false,
      })),
    )
    const seenInOnMutate: Array<string | undefined> = []
    const mutation = TestBed.runInInjectionContext(() =>
      injectMutation(() => ({
        mutationKey: ['zoneful-mutation'],
        mutationFn: async () => 'server',
        onMutate: () => {
          queryClient.setQueryData(key, 'optimistic')
          seenInOnMutate.push(query.data() as string | undefined)
        },
      })),
    )

    query.data()
    await mutation.mutateAsync()

    expect(seenInOnMutate).toEqual(['optimistic'])
  })

  it('emits a mutation throwOnError notification exactly once', async () => {
    const error = new Error('zoneful mutation error')
    const zone = TestBed.inject(NgZone)
    const emit = vi.spyOn(zone.onError, 'emit')
    const mutation = TestBed.runInInjectionContext(() =>
      injectMutation(() => ({
        mutationKey: ['zoneful-error'],
        mutationFn: async () => Promise.reject(error),
        throwOnError: true,
      })),
    )

    await mutation.mutateAsync().catch(() => undefined)

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith(error)
  })
})
