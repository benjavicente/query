import {
  ApplicationRef,
  Injector,
  runInInjectionContext,
  signal,
} from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { injectObserverSignal } from '../inject-observer-signal'
import { provideAngularQueryChangeDetection } from '../../__tests__/test-utils'

function makeSource(initial: number) {
  let value = initial
  const subscribers = new Set<() => void>()
  const retainedSubscribers: Array<() => void> = []

  return {
    get: () => value,
    set(next: number) {
      value = next
      subscribers.forEach((subscriber) => subscriber())
    },
    subscribe(subscriber: () => void) {
      subscribers.add(subscriber)
      retainedSubscribers.push(subscriber)
      return () => subscribers.delete(subscriber)
    },
    notifyRetainedSubscribers() {
      retainedSubscribers.forEach((subscriber) => subscriber())
    },
    subscriberCount: () => subscribers.size,
  }
}

describe('injectObserverSignal', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAngularQueryChangeDetection()],
    })
  })

  describe('initialization', () => {
    it('returns an initial snapshot before effects run', () => {
      const source = makeSource(1)
      const value = TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource: signal(undefined),
          getSnapshot: source.get,
          subscribe: source.subscribe,
        }),
      )

      expect(value()).toBe(1)
      expect(source.subscriberCount()).toBe(1)
    })

    it('initializes an unread subscription when effects run', async () => {
      const source = makeSource(1)
      TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource: signal(undefined),
          getSnapshot: source.get,
          subscribe: source.subscribe,
        }),
      )

      await TestBed.inject(ApplicationRef).whenStable()
      expect(source.subscriberCount()).toBe(1)
    })
  })

  describe('snapshots and updates', () => {
    it('reads notifications synchronously', () => {
      const source = makeSource(1)
      const value = TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource: signal(undefined),
          getSnapshot: source.get,
          subscribe: source.subscribe,
        }),
      )

      expect(value()).toBe(1)
      source.set(2)
      expect(value()).toBe(2)
      source.set(3)
      expect(value()).toBe(3)
    })

    it('applies updateSource before reading its snapshot', () => {
      const source = makeSource(0)
      const updateSource = signal(1)
      const update = vi.fn((next: number) => source.set(next))
      const subscribe = vi.fn(source.subscribe)
      const value = TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource,
          update,
          getSnapshot: source.get,
          subscribe,
        }),
      )

      expect(value()).toBe(1)
      updateSource.set(4)
      expect(value()).toBe(4)
      expect(update).toHaveBeenLastCalledWith(4)
      expect(subscribe).toHaveBeenCalledOnce()
    })

    it('uses updateSource as invalidation when update is omitted', () => {
      let snapshot = 1
      const updateSource = signal(1)
      const value = TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource,
          getSnapshot: () => snapshot,
          subscribe: () => () => undefined,
        }),
      )

      expect(value()).toBe(1)
      snapshot = 2
      updateSource.set(2)
      expect(value()).toBe(2)
    })

    it('does not track signals read by getSnapshot or update', () => {
      const snapshotSignal = signal(1)
      const incidental = signal(10)
      const updateSource = signal(1)
      const updates: Array<[number, number]> = []
      const value = TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource,
          update: (next) => updates.push([next, incidental()]),
          getSnapshot: () => snapshotSignal(),
          subscribe: () => () => undefined,
        }),
      )

      expect(value()).toBe(1)
      snapshotSignal.set(2)
      incidental.set(20)
      expect(value()).toBe(1)
      expect(updates).toEqual([[1, 10]])

      updateSource.set(2)
      expect(value()).toBe(2)
      expect(updates).toEqual([
        [1, 10],
        [2, 20],
      ])
    })

    it('propagates nested store notifications synchronously', () => {
      const firstSource = makeSource(0)
      const secondSource = makeSource(0)
      const updateSource = signal(1)

      const [firstValue, secondValue] = TestBed.runInInjectionContext(() => [
        injectObserverSignal({
          updateSource,
          update: (next) => {
            firstSource.set(next)
            secondSource.set(next * 10)
          },
          getSnapshot: firstSource.get,
          subscribe: firstSource.subscribe,
        }),
        injectObserverSignal({
          updateSource: signal(undefined),
          getSnapshot: secondSource.get,
          subscribe: secondSource.subscribe,
        }),
      ])

      expect(secondValue()).toBe(0)
      expect(firstValue()).toBe(1)
      expect(secondValue()).toBe(10)

      updateSource.set(2)
      expect(firstValue()).toBe(2)
      expect(secondValue()).toBe(20)
    })
  })

  describe('subscription', () => {
    it('supports a synchronous notification while subscribing', () => {
      const source = makeSource(1)
      const value = TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource: signal(undefined),
          getSnapshot: source.get,
          subscribe: (notify) => {
            const unsubscribe = source.subscribe(notify)
            notify()
            return unsubscribe
          },
        }),
      )

      expect(value()).toBe(1)
      expect(source.subscriberCount()).toBe(1)
    })

    it('can defer installing its single subscription until an update', () => {
      const source = makeSource(1)
      const canSubscribe = signal(false)
      const subscribe = vi.fn(source.subscribe)
      const value = TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource: canSubscribe,
          getSnapshot: source.get,
          subscribe: (notify) =>
            canSubscribe() ? subscribe(notify) : undefined,
        }),
      )

      expect(value()).toBe(1)
      expect(subscribe).not.toHaveBeenCalled()

      source.set(2)
      canSubscribe.set(true)
      expect(value()).toBe(2)
      expect(subscribe).toHaveBeenCalledOnce()

      canSubscribe.set(false)
      expect(value()).toBe(2)
      expect(source.subscriberCount()).toBe(1)

      source.set(3)
      expect(value()).toBe(3)
      expect(subscribe).toHaveBeenCalledOnce()
    })

    it('does not track signals read while installing the subscription', () => {
      const source = makeSource(1)
      const incidental = signal('first')
      const installedWith: Array<string> = []
      const value = TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource: signal(undefined),
          getSnapshot: source.get,
          subscribe: (notify) => {
            installedWith.push(incidental())
            return source.subscribe(notify)
          },
        }),
      )

      expect(value()).toBe(1)
      incidental.set('second')
      expect(value()).toBe(1)
      expect(installedWith).toEqual(['first'])
    })

    it('retries a failed subscription on a later update and ignores the stale callback', () => {
      const source = makeSource(1)
      const updateSource = signal(1)
      const subscribeError = new Error('subscription failed')
      let attempt = 0
      let staleNotify: (() => void) | undefined
      const getSnapshot = vi.fn(source.get)
      const subscribe = vi.fn((notify: () => void) => {
        attempt++
        if (attempt === 1) {
          staleNotify = notify
          throw subscribeError
        }
        return source.subscribe(notify)
      })
      const value = TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource,
          getSnapshot,
          subscribe,
        }),
      )

      expect(() => value()).toThrow(subscribeError)
      expect(subscribe).toHaveBeenCalledOnce()

      source.set(2)
      updateSource.set(2)
      expect(value()).toBe(2)
      expect(subscribe).toHaveBeenCalledTimes(2)

      getSnapshot.mockClear()
      staleNotify?.()
      expect(value()).toBe(2)
      expect(getSnapshot).not.toHaveBeenCalled()

      source.set(3)
      expect(value()).toBe(3)
      expect(subscribe).toHaveBeenCalledTimes(2)
    })
  })

  describe('cleanup and failures', () => {
    it('cleans up and ignores notifications after destruction', () => {
      const source = makeSource(1)
      const injector = Injector.create({
        providers: [],
        parent: TestBed.inject(Injector),
      })
      const value = runInInjectionContext(injector, () =>
        injectObserverSignal({
          updateSource: signal(undefined),
          getSnapshot: source.get,
          subscribe: source.subscribe,
        }),
      )

      expect(value()).toBe(1)
      injector.destroy()
      expect(source.subscriberCount()).toBe(0)
      source.set(2)
      source.notifyRetainedSubscribers()
      expect(value()).toBe(1)
    })

    it('cleans up a subscription when the initial snapshot fails', () => {
      const source = makeSource(1)
      const error = new Error('snapshot failed')
      const value = TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource: signal(undefined),
          getSnapshot: () => {
            throw error
          },
          subscribe: source.subscribe,
        }),
      )

      expect(() => value()).toThrow(error)
      expect(source.subscriberCount()).toBe(0)
    })

    it('propagates an update failure and recovers on a later update', () => {
      const source = makeSource(0)
      const updateSource = signal(1)
      const updateError = new Error('update failed')
      let shouldFail = true
      const update = vi.fn((next: number) => {
        if (shouldFail) throw updateError
        source.set(next)
      })
      const value = TestBed.runInInjectionContext(() =>
        injectObserverSignal({
          updateSource,
          update,
          getSnapshot: source.get,
          subscribe: source.subscribe,
        }),
      )

      expect(() => value()).toThrow(updateError)
      expect(update).toHaveBeenCalledWith(1)
      expect(source.subscriberCount()).toBe(0)

      shouldFail = false
      updateSource.set(2)
      expect(value()).toBe(2)
      expect(update).toHaveBeenLastCalledWith(2)
      expect(source.subscriberCount()).toBe(1)
    })
  })
})
