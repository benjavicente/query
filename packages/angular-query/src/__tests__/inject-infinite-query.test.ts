import { TestBed } from '@angular/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import { sleep } from '@tanstack/query-test-utils'
import { QueryClient, injectInfiniteQuery } from '..'
import { expectSignals, setupTanStackQueryTestBed } from './test-utils'

describe('injectInfiniteQuery', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient()
    vi.useFakeTimers()
    setupTanStackQueryTestBed(queryClient)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each(['refetch', 'fetchNextPage', 'fetchPreviousPage'] as const)(
    'applies current infinite-query options before %s',
    async (method) => {
      vi.useRealTimers()
      const version = signal('old')
      const query = TestBed.runInInjectionContext(() =>
        injectInfiniteQuery(() => {
          const current = version()
          return {
            queryKey: ['infinite'],
            enabled: false,
            initialPageParam: 0,
            initialData: { pages: ['initial'], pageParams: [0] },
            getNextPageParam: () => 1,
            getPreviousPageParam: () => -1,
            queryFn: async () => current,
          }
        }),
      )
      query.data()
      const execute = query[method]
      version.set('new')
      const result = await execute()
      expect(result.data?.pages).toContain('new')
      expect(result.data?.pages).not.toContain('old')
    },
  )

  it('should properly execute infinite query', async () => {
    @Component({
      selector: 'app-test',
      template: '',
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class TestComponent {
      query = injectInfiniteQuery(() => ({
        queryKey: ['infiniteQuery'],
        queryFn: ({ pageParam }) =>
          sleep(10).then(() => 'data on page ' + pageParam),
        initialPageParam: 0,
        getNextPageParam: () => 12,
      }))
    }

    const fixture = TestBed.createComponent(TestComponent)
    fixture.detectChanges()
    const query = fixture.componentInstance.query

    expectSignals(query, {
      data: undefined,
      status: 'pending',
    })

    await vi.advanceTimersByTimeAsync(11)

    expectSignals(query, {
      data: {
        pageParams: [0],
        pages: ['data on page 0'],
      },
      status: 'success',
    })

    void query.fetchNextPage()

    await vi.advanceTimersByTimeAsync(11)

    expectSignals(query, {
      data: {
        pageParams: [0, 12],
        pages: ['data on page 0', 'data on page 12'],
      },
      status: 'success',
    })
  })

  describe('injection context', () => {
    it('throws NG0203 with descriptive error outside injection context', () => {
      expect(() => {
        injectInfiniteQuery(() => ({
          queryKey: ['injectionContextError'],
          queryFn: ({ pageParam }) =>
            sleep(0).then(() => 'data on page ' + pageParam),
          initialPageParam: 0,
          getNextPageParam: () => 12,
        }))
      }).toThrowError(/NG0203(.*?)injectInfiniteQuery/)
    })
  })
})
