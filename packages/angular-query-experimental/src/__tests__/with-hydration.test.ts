import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  QueryClient,
  dehydrate,
  injectQuery,
  provideTanStackQuery,
  withHydration,
  TANSTACK_QUERY_HYDRATION_STATE_KEY,
} from '..'
import {
  Component,
  ENVIRONMENT_INITIALIZER,
  PLATFORM_ID,
  TransferState,
  effect,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core'
import { render } from '@testing-library/angular'
import { queryKey, sleep } from '@tanstack/query-test-utils'
import { provideServerTanStackQueryHydration } from '../server'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('withHydration (client)', () => {
  test('hydrates QueryClient from TransferState in the browser', async () => {
    const key = queryKey()
    const sourceClient = new QueryClient()
    sourceClient.prefetchQuery({
      queryKey: key,
      queryFn: () => sleep(10).then(() => 'from-server'),
    })
    await vi.advanceTimersByTimeAsync(10)

    const dehydrated = dehydrate(sourceClient)
    const appClient = new QueryClient()

    @Component({
      template: `<div>{{ state.data() ?? '' }}</div>`,
    })
    class Page {
      state = injectQuery(() => ({
        queryKey: key,
        queryFn: () => sleep(10).then(() => 'from-client'),
      }))
    }

    const rendered = await render(Page, {
      providers: [
        provideEnvironmentInitializer(() => {
          const transferState = inject(TransferState)
          transferState.set(TANSTACK_QUERY_HYDRATION_STATE_KEY, dehydrated)
        }),
        provideTanStackQuery(appClient, withHydration()),
      ],
    })

    rendered.fixture.detectChanges()
    expect(rendered.getByText('from-server')).toBeInTheDocument()

    const transferState = rendered.fixture.debugElement.injector.get(
      TransferState,
    )
    expect(
      transferState.get(TANSTACK_QUERY_HYDRATION_STATE_KEY, null),
    ).toBeNull()
  })

  test('does not fetch when hydrated data is already success', async () => {
    const key = queryKey()
    const sourceClient = new QueryClient()
    sourceClient.setQueryData(key, 'cached')
    const dehydrated = dehydrate(sourceClient)
    const appClient = new QueryClient()

    let queryFnCalls = 0

    @Component({
      template: `<div>{{ state.data() ?? '' }}</div>`,
    })
    class Page {
      state = injectQuery(() => ({
        queryKey: key,
        staleTime: Infinity,
        queryFn: () => {
          queryFnCalls++
          return sleep(10).then(() => 'should-not-run')
        },
      }))
      _ = effect(() => {
        void this.state.data()
      })
    }

    await render(Page, {
      providers: [
        provideEnvironmentInitializer(() => {
          const transferState = inject(TransferState)
          transferState.set(TANSTACK_QUERY_HYDRATION_STATE_KEY, dehydrated)
        }),
        provideTanStackQuery(appClient, withHydration()),
      ],
    })

    await vi.advanceTimersByTimeAsync(100)
    expect(queryFnCalls).toBe(0)
  })
})

describe('provideServerTanStackQueryHydration (server)', () => {
  test('includes dehydrated queries when TransferState.toJson runs on server', async () => {
    const key = queryKey()
    const queryClient = new QueryClient()

    const { TestBed } = await import('@angular/core/testing')
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        ...provideTanStackQuery(queryClient),
        provideServerTanStackQueryHydration(),
      ],
    })

    await TestBed.compileComponents()
    TestBed.inject(ENVIRONMENT_INITIALIZER)

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: () => Promise.resolve('ssr-data'),
    })
    await vi.advanceTimersByTimeAsync(0)

    TestBed.inject(TransferState).toJson()

    const stored = TestBed.inject(TransferState).get(
      TANSTACK_QUERY_HYDRATION_STATE_KEY,
      null,
    )
    expect(stored).not.toBeNull()
    if (!stored) {
      throw new Error('expected dehydrated state')
    }
    expect(stored.queries.length).toBe(1)
    expect(stored.queries[0]?.queryKey).toEqual(key)
  })

  test('omits in-flight queries until they reach success (default dehydrate)', async () => {
    const key = queryKey()
    const queryClient = new QueryClient()

    const { TestBed } = await import('@angular/core/testing')
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        ...provideTanStackQuery(queryClient),
        provideServerTanStackQueryHydration(),
      ],
    })

    await TestBed.compileComponents()
    TestBed.inject(ENVIRONMENT_INITIALIZER)

    void queryClient.prefetchQuery({
      queryKey: key,
      queryFn: () => sleep(10).then(() => 'ssr-data'),
    })

    TestBed.inject(TransferState).toJson()

    const stored = TestBed.inject(TransferState).get(
      TANSTACK_QUERY_HYDRATION_STATE_KEY,
      null,
    )
    expect(stored).not.toBeNull()
    if (!stored) {
      throw new Error('expected dehydrated state')
    }
    expect(stored.queries.length).toBe(0)
  })

  test('does not register TanStack dehydrate onSerialize when platform is browser', async () => {
    const key = queryKey()
    const queryClient = new QueryClient()

    const { TestBed } = await import('@angular/core/testing')
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        ...provideTanStackQuery(queryClient),
        provideServerTanStackQueryHydration(),
      ],
    })

    await TestBed.compileComponents()
    TestBed.inject(ENVIRONMENT_INITIALIZER)

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: () => Promise.resolve('data'),
    })
    await vi.advanceTimersByTimeAsync(0)

    TestBed.inject(TransferState).toJson()

    expect(
      TestBed.inject(TransferState).get(TANSTACK_QUERY_HYDRATION_STATE_KEY, null),
    ).toBeNull()
  })
})
