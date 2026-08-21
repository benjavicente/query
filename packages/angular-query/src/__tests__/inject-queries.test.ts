import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/angular'
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  NgZone,
  computed,
  effect,
  input,
  inputBinding,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { queryKey, sleep } from '@tanstack/query-test-utils'
import {
  QueryClient,
  onlineManager,
  provideIsRestoring,
  provideTanStackQuery,
  skipToken,
} from '..'
import { injectQueries } from '../inject-queries'
import { setupTanStackQueryTestBed } from './test-utils'

let queryClient: QueryClient

beforeEach(() => {
  vi.useFakeTimers()
  queryClient = new QueryClient()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setupTanStackQueryTestBed(queryClient)
})

afterEach(() => {
  onlineManager.setOnline(true)
  vi.useRealTimers()
})

describe('injectQueries', () => {
  it('throws NG0203 with descriptive error outside injection context', () => {
    expect(() => {
      injectQueries(() => ({
        queries: [
          {
            queryKey: ['injectionContextError'],
            queryFn: () => Promise.resolve(1),
          },
        ],
      }))
    }).toThrowError(/NG0203(.*?)injectQueries/)
  })

  it('should return the correct states', async () => {
    const key1 = queryKey()
    const key2 = queryKey()
    const results: Array<Array<Record<string, any>>> = []

    @Component({
      template: `
        <div>
          <div>
            data1: {{ queries()[0].data() ?? 'null' }}, data2:
            {{ queries()[1].data() ?? 'null' }}
          </div>
        </div>
      `,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      toString(val: any) {
        return String(val)
      }
      queries = injectQueries(() => ({
        queries: [
          {
            queryKey: key1,
            queryFn: () => sleep(10).then(() => 1),
          },
          {
            queryKey: key2,
            queryFn: () => sleep(100).then(() => 2),
          },
        ],
      }))

      _pushResults = effect(() => {
        const snapshot = this.queries().map((q) => ({ data: q.data() }))
        results.push(snapshot)
      })
    }

    const rendered = await render(Page, {
      providers: [
        provideZonelessChangeDetection(),
        provideTanStackQuery(() => queryClient),
      ],
    })

    await vi.advanceTimersByTimeAsync(101)
    rendered.fixture.detectChanges()

    expect(rendered.getByText('data1: 1, data2: 2')).toBeInTheDocument()

    expect(results.length).toBe(3)
    expect(results[0]).toMatchObject([{ data: undefined }, { data: undefined }])
    expect(results[1]).toMatchObject([{ data: 1 }, { data: undefined }])
    expect(results[2]).toMatchObject([{ data: 1 }, { data: 2 }])
  })

  it('should update a result field first read after an earlier update', async () => {
    let count = 0

    @Component({
      template: '',
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      queries = injectQueries(() => ({
        queries: [
          {
            queryKey: ['late-field-tracking'],
            queryFn: async () => {
              await sleep(10)
              return ++count
            },
          },
        ],
      }))
    }

    const rendered = await render(Page)
    const query = rendered.fixture.componentInstance.queries()[0]

    // Only status is read before the first observer update.
    expect(query.status()).toBe('pending')

    await vi.advanceTimersByTimeAsync(11)
    expect(query.status()).toBe('success')

    // Data starts being observed after the result signal already contains a
    // subscription update. It must still participate in future notifications.
    expect(query.data()).toBe(1)

    const refetch = query.refetch()
    await vi.advanceTimersByTimeAsync(11)
    await refetch

    expect(query.data()).toBe(2)
  })

  it('should support combining results', async () => {
    const key1 = queryKey()
    const key2 = queryKey()
    let count = 0

    const results: Array<{ data: string; refetch: () => void }> = []

    @Component({
      template: ` <div>data: {{ queries().data }}</div> `,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      queries = injectQueries(() => ({
        queries: [
          {
            queryKey: key1,
            queryFn: async () => {
              await new Promise((r) => setTimeout(r, 10))
              count++
              return count
            },
          },
          {
            queryKey: key2,
            queryFn: async () => {
              await new Promise((r) => setTimeout(r, 100))
              count++
              return count
            },
          },
        ],
        combine: (queryResults) => {
          return {
            refetch: () => queryResults.forEach((r) => r.refetch()),
            data: queryResults.map((r) => r.data).join(','),
          }
        },
      }))

      _pushResults = effect(() => {
        results.push(this.queries())
      })
    }

    const rendered = await render(Page)
    const instance = rendered.fixture.componentInstance
    await rendered.findByText('data: 1,2')
    expect(instance.queries().data).toBe('1,2')

    instance.queries().refetch()

    await rendered.findByText('data: 3,4')
    expect(instance.queries().data).toBe('3,4')

    expect(results).toHaveLength(5)
    expect(results[0]).toMatchObject({
      data: ',',
      refetch: expect.any(Function),
    })
    expect(results[1]).toMatchObject({
      data: '1,',
      refetch: expect.any(Function),
    })
    expect(results[2]).toMatchObject({
      data: '1,2',
      refetch: expect.any(Function),
    })
    expect(results[3]).toMatchObject({
      data: '3,2',
      refetch: expect.any(Function),
    })
    expect(results[4]).toMatchObject({
      data: '3,4',
      refetch: expect.any(Function),
    })
  })

  it('should handle mixed success and error query states', async () => {
    @Component({
      template: '',
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      queries = injectQueries(() => ({
        queries: [
          {
            queryKey: ['mixed-error'],
            retry: false,
            queryFn: async () => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              throw new Error('mixed-error')
            },
          },
          {
            queryKey: ['mixed-success'],
            queryFn: async () => {
              await new Promise((resolve) => setTimeout(resolve, 20))
              return 'mixed-success'
            },
          },
        ],
      }))
    }

    const rendered = await render(Page)
    await vi.advanceTimersByTimeAsync(25)
    await Promise.resolve()

    const [errorQuery, successQuery] =
      rendered.fixture.componentInstance.queries()
    expect(errorQuery.status()).toBe('error')
    expect(errorQuery.error()?.message).toBe('mixed-error')
    expect(successQuery.status()).toBe('success')
    expect(successQuery.data()).toBe('mixed-success')
  })

  describe('throwOnError', () => {
    it('should evaluate throwOnError for the failed query', async () => {
      const boundaryFn = vi.fn(() => false)

      @Component({
        template: '',
        changeDetection: ChangeDetectionStrategy.OnPush,
      })
      class Page {
        queries = injectQueries(() => ({
          queries: [
            {
              queryKey: ['queries-throw-predicate'],
              queryFn: () =>
                sleep(10).then(() =>
                  Promise.reject(new Error('queries predicate error')),
                ),
              retry: false,
              throwOnError: boundaryFn,
            },
          ],
        }))
      }

      TestBed.createComponent(Page).detectChanges()

      await vi.advanceTimersByTimeAsync(11)

      expect(boundaryFn).toHaveBeenCalledTimes(1)
      expect(boundaryFn).toHaveBeenCalledWith(
        Error('queries predicate error'),
        expect.objectContaining({
          state: expect.objectContaining({ status: 'error' }),
        }),
      )
    })

    it('should throw when throwOnError is true', async () => {
      const zone = TestBed.inject(NgZone)
      const zoneErrorPromise = new Promise<Error>((resolve) => {
        const sub = zone.onError.subscribe((error) => {
          sub.unsubscribe()
          resolve(error as Error)
        })
      })
      let resolveProcessError!: (error: Error) => void
      const handler = (error: Error) => {
        process.off('uncaughtException', handler)
        resolveProcessError(error)
      }
      const processErrorPromise = new Promise<Error>((resolve) => {
        resolveProcessError = resolve
      })
      process.on('uncaughtException', handler)

      @Component({
        template: '',
        changeDetection: ChangeDetectionStrategy.OnPush,
      })
      class Page {
        queries = injectQueries(() => ({
          queries: [
            {
              queryKey: ['queries-throw-true'],
              queryFn: () =>
                sleep(0).then(() =>
                  Promise.reject(new Error('queries throw error')),
                ),
              retry: false,
              throwOnError: true,
            },
          ],
        }))
      }

      TestBed.createComponent(Page).detectChanges()

      try {
        await vi.runAllTimersAsync()
        await expect(zoneErrorPromise).resolves.toEqual(
          Error('queries throw error'),
        )
        await expect(processErrorPromise).resolves.toEqual(
          Error('queries throw error'),
        )
      } finally {
        process.off('uncaughtException', handler)
      }
    })

    it('should throw when throwOnError function returns true', async () => {
      const zone = TestBed.inject(NgZone)
      const zoneErrorPromise = new Promise<Error>((resolve) => {
        const sub = zone.onError.subscribe((error) => {
          sub.unsubscribe()
          resolve(error as Error)
        })
      })
      let resolveProcessError!: (error: Error) => void
      const handler = (error: Error) => {
        process.off('uncaughtException', handler)
        resolveProcessError(error)
      }
      const processErrorPromise = new Promise<Error>((resolve) => {
        resolveProcessError = resolve
      })
      process.on('uncaughtException', handler)

      @Component({
        template: '',
        changeDetection: ChangeDetectionStrategy.OnPush,
      })
      class Page {
        queries = injectQueries(() => ({
          queries: [
            {
              queryKey: ['queries-throw-function'],
              queryFn: () =>
                sleep(0).then(() =>
                  Promise.reject(new Error('queries function error')),
                ),
              retry: false,
              throwOnError: () => true,
            },
          ],
        }))
      }

      TestBed.createComponent(Page).detectChanges()

      try {
        await vi.runAllTimersAsync()
        await expect(zoneErrorPromise).resolves.toEqual(
          Error('queries function error'),
        )
        await expect(processErrorPromise).resolves.toEqual(
          Error('queries function error'),
        )
      } finally {
        process.off('uncaughtException', handler)
      }
    })
  })

  it('should cleanup pending tasks when component with active queries is destroyed', async () => {
    @Component({
      template: '',
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      queries = injectQueries(() => ({
        queries: [
          {
            queryKey: ['destroy-query-1'],
            queryFn: async () => {
              await sleep(100)
              return 'one'
            },
          },
          {
            queryKey: ['destroy-query-2'],
            queryFn: async () => {
              await sleep(100)
              return 'two'
            },
          },
        ],
      }))
    }

    // Use a fixture here on purpose: we need component teardown + whenStable() semantics.
    const fixture = TestBed.createComponent(Page)
    fixture.detectChanges()
    expect(fixture.isStable()).toBe(false)

    fixture.destroy()

    const stablePromise = fixture.whenStable()
    await vi.advanceTimersByTimeAsync(150)
    await stablePromise

    expect(fixture.isStable()).toBe(true)
  })

  it('should react to enabled signal changes', async () => {
    const enabled = signal(false)
    const fetchSpy = vi.fn(() => sleep(10).then(() => 'enabled-data'))

    @Component({
      template: '',
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      enabled = enabled
      fetchSpy = fetchSpy

      queries = injectQueries(() => ({
        queries: [
          {
            queryKey: ['enabled', this.enabled()],
            queryFn: this.fetchSpy,
            enabled: this.enabled(),
          },
        ],
      }))
    }

    const rendered = await render(Page)
    const query = rendered.fixture.componentInstance.queries()[0]

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(query.status()).toBe('pending')

    enabled.set(true)
    rendered.fixture.detectChanges()
    await vi.advanceTimersByTimeAsync(11)
    await Promise.resolve()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(query.status()).toBe('success')
    expect(query.data()).toBe('enabled-data')
  })

  it('should not resubscribe or refetch unchanged stale queries when options change', async () => {
    const multiplier = signal(1)
    const fetchSpy = vi.fn(() => sleep(10).then(() => 2))

    @Component({
      template: '',
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      queries = injectQueries(() => {
        const currentMultiplier = multiplier()

        return {
          queries: [
            {
              queryKey: ['reactive-select'],
              queryFn: fetchSpy,
              select: (data: number) => data * currentMultiplier,
              staleTime: 0,
            },
          ],
        }
      })
    }

    const rendered = await render(Page)
    await vi.advanceTimersByTimeAsync(11)

    const query = rendered.fixture.componentInstance.queries()[0]
    const cachedQuery = queryClient
      .getQueryCache()
      .find({ queryKey: ['reactive-select'] })!

    expect(query.data()).toBe(2)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(cachedQuery.getObserversCount()).toBe(1)

    multiplier.set(2)
    rendered.fixture.detectChanges()
    await vi.advanceTimersByTimeAsync(0)

    expect(query.data()).toBe(4)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(cachedQuery.getObserversCount()).toBe(1)

    rendered.fixture.destroy()
    expect(cachedQuery.getObserversCount()).toBe(0)
  })

  it('should refetch only changed keys when queries length stays the same', async () => {
    const ids = signal<[string, string]>(['a', 'b'])
    const firstSpy = vi.fn((context: any) =>
      sleep(10).then(() => `first-${context.queryKey[1]}`),
    )
    const secondSpy = vi.fn((context: any) =>
      sleep(10).then(() => `second-${context.queryKey[1]}`),
    )

    @Component({
      template: '',
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      ids = ids
      firstSpy = firstSpy
      secondSpy = secondSpy

      queries = injectQueries(() => ({
        queries: [
          {
            staleTime: Number.POSITIVE_INFINITY,
            queryKey: ['first', this.ids()[0]],
            queryFn: this.firstSpy,
          },
          {
            staleTime: Number.POSITIVE_INFINITY,
            queryKey: ['second', this.ids()[1]],
            queryFn: this.secondSpy,
          },
        ],
      }))
    }

    const rendered = await render(Page)
    await vi.advanceTimersByTimeAsync(11)
    await Promise.resolve()

    let [firstQuery, secondQuery] = rendered.fixture.componentInstance.queries()
    expect(firstQuery.data()).toBe('first-a')
    expect(secondQuery.data()).toBe('second-b')
    expect(firstSpy).toHaveBeenCalledTimes(1)
    expect(secondSpy).toHaveBeenCalledTimes(1)

    ids.set(['c', 'b'])
    rendered.fixture.detectChanges()
    await vi.advanceTimersByTimeAsync(11)
    await Promise.resolve()
    ;[firstQuery, secondQuery] = rendered.fixture.componentInstance.queries()
    expect(firstQuery.data()).toBe('first-c')
    expect(secondQuery.data()).toBe('second-b')
    expect(firstSpy).toHaveBeenCalledTimes(2)
    expect(secondSpy).toHaveBeenCalledTimes(1)
  })

  it('should support changes on the queries array', async () => {
    const results: Array<Array<Record<string, any>>> = []

    @Component({
      template: ` <div>data: {{ mapped() }}</div> `,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      queries = injectQueries(() => ({
        queries: queries().map((q) => ({
          queryKey: ['query', q],
          queryFn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 20 * q))
            return q
          },
        })),
      }))

      mapped = computed(() => {
        const queryData = this.queries().map((q) => q.data())
        if (queryData.length === 0) return 'empty'
        return queryData.join(',')
      })

      _pushResults = effect(() => {
        const snapshot = this.queries().map((q) => ({ data: q.data() }))
        results.push(snapshot)
      })
    }

    const queries = signal([1, 2, 4])

    const rendered = await render(Page)
    const instance = rendered.fixture.componentInstance

    await rendered.findByText('data: 1,2,4')
    expect(instance.mapped()).toBe('1,2,4')

    expect(results.length).toBe(4)
    expect(results[0]).toMatchObject([
      { data: undefined },
      { data: undefined },
      { data: undefined },
    ])
    expect(results[1]).toMatchObject([
      { data: 1 },
      { data: undefined },
      { data: undefined },
    ])
    expect(results[2]).toMatchObject([
      { data: 1 },
      { data: 2 },
      { data: undefined },
    ])
    expect(results[3]).toMatchObject([{ data: 1 }, { data: 2 }, { data: 4 }])

    queries.set([3, 4])
    await rendered.findByText('data: 3,4')
    expect(instance.mapped()).toBe('3,4')

    const hasOptimisticTransition = results.some(
      (snapshot) =>
        snapshot.length === 2 &&
        snapshot[0]?.data === undefined &&
        snapshot[1]?.data === 4,
    )
    expect(hasOptimisticTransition).toBe(true)
    expect(results[results.length - 1]).toMatchObject([
      { data: 3 },
      { data: 4 },
    ])

    queries.set([])
    await rendered.findByText('data: empty')
    expect(instance.mapped()).toBe('empty')

    expect(results[results.length - 1]).toMatchObject([])
  })

  it('should change the rendered component when the queries array changes', async () => {
    const userIds = signal([1, 2])

    @Component({
      template: `
        <ul>
          @for (query of queries(); track $index) {
            @if (query.data(); as data) {
              <li>{{ data.value }}</li>
            }
          }
        </ul>
      `,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      userIds = userIds

      queries = injectQueries(() => ({
        queries: this.userIds().map((id) => ({
          queryKey: ['user', id],
          queryFn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 20))
            return { value: String(id) }
          },
        })),
      }))
    }

    const rendered = await render(Page)

    await rendered.findByText('1')
    await rendered.findByText('2')

    userIds.set([3])
    rendered.fixture.detectChanges()

    await rendered.findByText('3')
    expect(rendered.queryByText('1')).toBeNull()
    expect(rendered.queryByText('2')).toBeNull()
  })

  it('should support required signal inputs', async () => {
    @Component({
      selector: 'app-fake',
      template: `{{ queries()[0].data() }}`,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class FakeComponent {
      name = input.required<string>()

      queries = injectQueries(() => ({
        queries: [
          {
            queryKey: ['fake', this.name()],
            queryFn: () => this.name(),
          },
        ],
      }))
    }

    const name = signal('signal-input-required-test')
    const rendered = await render(FakeComponent, {
      bindings: [inputBinding('name', name.asReadonly())],
      detectChangesOnRender: false,
    })
    rendered.fixture.detectChanges()
    await vi.advanceTimersByTimeAsync(0)

    const result = rendered.fixture.nativeElement.textContent
    expect(result).toEqual('signal-input-required-test')
  })

  it('should allow reading query state in ngOnInit with required signal inputs', async () => {
    @Component({
      template: '',
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      name = input.required<string>()
      initialStatus!: string

      queries = injectQueries(() => ({
        queries: [
          {
            queryKey: ['queries-ng-on-init', this.name()],
            queryFn: () => this.name(),
          },
        ],
      }))

      ngOnInit() {
        this.initialStatus = this.queries()[0].status()
      }
    }

    const name = signal('queries-ng-on-init')
    const rendered = await render(Page, {
      bindings: [inputBinding('name', name.asReadonly())],
      detectChangesOnRender: false,
    })

    rendered.fixture.detectChanges()

    expect(rendered.fixture.componentInstance.initialStatus).toBe('pending')

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.fixture.componentInstance.queries()[0].data()).toBe(
      'queries-ng-on-init',
    )
  })

  describe('pending tasks', () => {
    it('should handle synchronous success and error before whenStable resolves', async () => {
      const app = TestBed.inject(ApplicationRef)

      @Component({
        template: '',
        changeDetection: ChangeDetectionStrategy.OnPush,
      })
      class Page {
        queries = injectQueries(() => ({
          queries: [
            {
              queryKey: ['queries-sync-success'],
              queryFn: () => 'instant-data',
            },
            {
              queryKey: ['queries-sync-error'],
              queryFn: () => {
                throw new Error('instant-error')
              },
              retry: false,
            },
          ],
        }))
      }

      const fixture = TestBed.createComponent(Page)
      fixture.detectChanges()
      const [successQuery, errorQuery] = fixture.componentInstance.queries()

      expect(successQuery.status()).toBe('pending')
      expect(errorQuery.status()).toBe('pending')

      const stablePromise = app.whenStable()
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(10)
      await stablePromise

      expect(successQuery.status()).toBe('success')
      expect(successQuery.data()).toBe('instant-data')
      expect(errorQuery.status()).toBe('error')
      expect(errorQuery.error()).toEqual(new Error('instant-error'))
    })

    it('should not register pending tasks for disabled queries', async () => {
      const queryFn = vi.fn(() => Promise.resolve('disabled-data'))

      @Component({
        template: '',
        changeDetection: ChangeDetectionStrategy.OnPush,
      })
      class Page {
        queries = injectQueries(() => ({
          queries: [
            {
              queryKey: ['queries-disabled-enabled'],
              queryFn,
              enabled: false,
            },
            {
              queryKey: ['queries-disabled-skip-token'],
              queryFn: skipToken,
            },
          ],
        }))
      }

      const fixture = TestBed.createComponent(Page)
      fixture.detectChanges()
      await Promise.resolve()

      const [disabledQuery, skippedQuery] = fixture.componentInstance.queries()
      expect(disabledQuery.fetchStatus()).toBe('idle')
      expect(skippedQuery.fetchStatus()).toBe('idle')
      expect(queryFn).not.toHaveBeenCalled()
      expect(fixture.isStable()).toBe(true)
    })

    it('should stay pending while queries are paused offline', async () => {
      const app = TestBed.inject(ApplicationRef)
      onlineManager.setOnline(false)

      @Component({
        template: '',
        changeDetection: ChangeDetectionStrategy.OnPush,
      })
      class Page {
        queries = injectQueries(() => ({
          queries: [
            {
              queryKey: ['queries-start-offline'],
              queryFn: () => sleep(10).then(() => 'online-data'),
            },
          ],
        }))
      }

      const fixture = TestBed.createComponent(Page)
      fixture.detectChanges()
      await Promise.resolve()

      const query = fixture.componentInstance.queries()[0]
      expect(query.fetchStatus()).toBe('paused')

      let stableResolved = false
      const stablePromise = app.whenStable().then(() => {
        stableResolved = true
      })
      await Promise.resolve()
      expect(stableResolved).toBe(false)

      onlineManager.setOnline(true)
      await vi.advanceTimersByTimeAsync(20)
      await stablePromise

      expect(query.status()).toBe('success')
      expect(query.data()).toBe('online-data')
    })

    it('should handle rapid refetches without leaking a pending task', async () => {
      const app = TestBed.inject(ApplicationRef)
      let count = 0

      @Component({
        template: '',
        changeDetection: ChangeDetectionStrategy.OnPush,
      })
      class Page {
        queries = injectQueries(() => ({
          queries: [
            {
              queryKey: ['queries-rapid-refetch'],
              queryFn: async () => {
                await sleep(10)
                return ++count
              },
            },
          ],
        }))
      }

      const fixture = TestBed.createComponent(Page)
      fixture.detectChanges()
      const query = fixture.componentInstance.queries()[0]

      query.refetch()
      query.refetch()
      query.refetch()

      const stablePromise = app.whenStable()
      await vi.advanceTimersByTimeAsync(20)
      await stablePromise

      expect(query.status()).toBe('success')
      expect(query.data()).toBeGreaterThan(0)
      expect(fixture.isStable()).toBe(true)
    })

    it('should release the pending task when a query is cancelled', async () => {
      const app = TestBed.inject(ApplicationRef)

      @Component({
        template: '',
        changeDetection: ChangeDetectionStrategy.OnPush,
      })
      class Page {
        queries = injectQueries(() => ({
          queries: [
            {
              queryKey: ['queries-cancel'],
              queryFn: () => sleep(100).then(() => 'data'),
            },
          ],
        }))
      }

      const fixture = TestBed.createComponent(Page)
      fixture.detectChanges()
      const query = fixture.componentInstance.queries()[0]

      await vi.advanceTimersByTimeAsync(20)
      await queryClient.cancelQueries({ queryKey: ['queries-cancel'] })
      await app.whenStable()

      expect(query.status()).toBe('pending')
      expect(query.fetchStatus()).toBe('idle')
      expect(fixture.isStable()).toBe(true)
    })

    it('should keep the pending task through retries', async () => {
      const app = TestBed.inject(ApplicationRef)
      let attemptCount = 0

      @Component({
        template: '',
        changeDetection: ChangeDetectionStrategy.OnPush,
      })
      class Page {
        queries = injectQueries(() => ({
          queries: [
            {
              queryKey: ['queries-retry'],
              retry: 2,
              retryDelay: 10,
              queryFn: () => {
                attemptCount++
                if (attemptCount <= 2) {
                  throw new Error(`Attempt ${attemptCount} failed`)
                }
                return 'success-data'
              },
            },
          ],
        }))
      }

      const fixture = TestBed.createComponent(Page)
      fixture.detectChanges()
      const query = fixture.componentInstance.queries()[0]

      const stablePromise = app.whenStable()
      await vi.advanceTimersByTimeAsync(50)
      await stablePromise

      expect(query.status()).toBe('success')
      expect(query.data()).toBe('success-data')
      expect(attemptCount).toBe(3)
    })
  })

  it('should pause fetching while restoring and fetch once restoring is disabled', async () => {
    const isRestoring = signal(true)
    const fetchSpy = vi.fn(() => sleep(10).then(() => 'restored-data'))
    setupTanStackQueryTestBed(queryClient, {
      providers: [provideIsRestoring(isRestoring.asReadonly())],
    })

    @Component({
      template: '',
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      queries = injectQueries(() => ({
        queries: [
          {
            queryKey: ['restoring'],
            queryFn: fetchSpy,
          },
        ],
      }))
    }

    const fixture = TestBed.createComponent(Page)
    fixture.detectChanges()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(fixture.componentInstance.queries()[0].status()).toBe('pending')

    const stablePromise = fixture.whenStable()
    await Promise.resolve()
    await stablePromise

    isRestoring.set(false)
    fixture.detectChanges()

    await vi.advanceTimersByTimeAsync(11)
    await fixture.whenStable()

    const result = fixture.componentInstance.queries()[0]
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result.status()).toBe('success')
    expect(result.data()).toBe('restored-data')

    const cachedQuery = queryClient
      .getQueryCache()
      .find({ queryKey: ['restoring'] })!
    expect(cachedQuery.getObserversCount()).toBe(1)

    fixture.destroy()
    expect(cachedQuery.getObserversCount()).toBe(0)
  })

  it('should complete queries before whenStable resolves', async () => {
    const app = TestBed.inject(ApplicationRef)

    @Component({
      template: '',
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      queries = injectQueries(() => ({
        queries: [
          {
            queryKey: ['query-1'],
            queryFn: async () => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              return 1
            },
          },
          {
            queryKey: ['query-2'],
            queryFn: async () => {
              await new Promise((resolve) => setTimeout(resolve, 20))
              return 2
            },
          },
        ],
      }))
    }

    const fixture = TestBed.createComponent(Page)
    fixture.detectChanges()

    const stablePromise = app.whenStable()
    let stableResolved = false
    void stablePromise.then(() => {
      stableResolved = true
    })

    await Promise.resolve()
    expect(stableResolved).toBe(false)

    await vi.advanceTimersByTimeAsync(25)
    await stablePromise

    const result = fixture.componentInstance.queries()
    expect(result[0].status()).toBe('success')
    expect(result[1].status()).toBe('success')
    expect(result[0].data()).toBe(1)
    expect(result[1].data()).toBe(2)
  })

  it('should use latest query key for aliased refetch function', async () => {
    const key = signal('one')
    const fetchSpy = vi.fn(async (context: any) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return context.queryKey[1]
    })

    @Component({
      template: '',
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Page {
      key = key
      fetchSpy = fetchSpy

      queries = injectQueries(() => ({
        queries: [
          {
            queryKey: ['query', this.key()],
            queryFn: this.fetchSpy,
            enabled: false,
          },
        ],
      }))
    }

    const rendered = await render(Page)
    const query = rendered.fixture.componentInstance.queries()[0]
    const refetch = query.refetch

    key.set('two')
    rendered.fixture.detectChanges()

    const refetchPromise = refetch()
    await vi.advanceTimersByTimeAsync(15)
    await refetchPromise

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['query', 'two'],
      }),
    )
  })
})
