import {
  Injector,
  runInInjectionContext,
  signal,
} from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { injectLinkedStoreSignal } from '../inject-linked-store-signal'
import { provideAngularQueryChangeDetection } from '../../__tests__/test-utils'

function makeSubscription() {
  const subscribers = new Set<() => void>()
  const retainedSubscribers: Array<() => void> = []

  return {
    subscribe(subscriber: () => void) {
      subscribers.add(subscriber)
      retainedSubscribers.push(subscriber)
      return () => subscribers.delete(subscriber)
    },
    notify() {
      subscribers.forEach((subscriber) => subscriber())
    },
    notifyRetainedSubscribers() {
      retainedSubscribers.forEach((subscriber) => subscriber())
    },
    subscriberCount: () => subscribers.size,
  }
}

describe('injectLinkedStoreSignal', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAngularQueryChangeDetection()],
    })
  })

  describe('initialization', () => {
    it('installs its subscription immediately without computing the value', () => {
      const store = makeSubscription()
      const computation = vi.fn(() => 1)
      const value = TestBed.runInInjectionContext(() =>
        injectLinkedStoreSignal({ computation, subscribe: store.subscribe }),
      )

      expect(store.subscriberCount()).toBe(1)
      expect(computation).not.toHaveBeenCalled()

      expect(value()).toBe(1)
      expect(computation).toHaveBeenCalledOnce()
    })

    it('does not compute during an immediate subscription notification', () => {
      const computation = vi.fn(() => 1)
      const value = TestBed.runInInjectionContext(() =>
        injectLinkedStoreSignal({
          computation,
          subscribe: (notify) => {
            notify()
            return () => undefined
          },
        }),
      )

      expect(computation).not.toHaveBeenCalled()
      expect(value()).toBe(1)
      expect(computation).toHaveBeenCalledOnce()
    })

    it('returns its initial computation on first read', () => {
      const store = makeSubscription()
      const value = TestBed.runInInjectionContext(() =>
        injectLinkedStoreSignal({
          computation: () => 1,
          subscribe: store.subscribe,
        }),
      )

      expect(value()).toBe(1)
      expect(store.subscriberCount()).toBe(1)
    })

    it('propagates a subscription failure without evaluating the computation', () => {
      const error = new Error('subscription failed')
      const computation = vi.fn(() => 1)
      const subscribe = vi.fn(() => {
        throw error
      })

      expect(() =>
        TestBed.runInInjectionContext(() =>
          injectLinkedStoreSignal({ computation, subscribe }),
        ),
      ).toThrow(error)
      expect(subscribe).toHaveBeenCalledOnce()
      expect(computation).not.toHaveBeenCalled()
    })
  })

  describe('reactivity', () => {
    it('tracks Angular signals read by computation', () => {
      const store = makeSubscription()
      const source = signal(1)
      const value = TestBed.runInInjectionContext(() =>
        injectLinkedStoreSignal({
          computation: () => source(),
          subscribe: store.subscribe,
        }),
      )

      expect(value()).toBe(1)
      source.set(2)
      expect(value()).toBe(2)
    })

    it('updates dynamic computation dependencies after a store change', () => {
      const store = makeSubscription()
      const firstSource = signal(1)
      const secondSource = signal(10)
      let useSecondSource = false
      const value = TestBed.runInInjectionContext(() =>
        injectLinkedStoreSignal({
          computation: () => (useSecondSource ? secondSource() : firstSource()),
          subscribe: store.subscribe,
        }),
      )

      expect(value()).toBe(1)

      useSecondSource = true
      store.notify()
      expect(value()).toBe(10)

      firstSource.set(2)
      expect(value()).toBe(10)

      secondSource.set(20)
      expect(value()).toBe(20)
    })

    it('recomputes synchronously for external notifications', () => {
      const store = makeSubscription()
      let source = 1
      const value = TestBed.runInInjectionContext(() =>
        injectLinkedStoreSignal({
          computation: () => source,
          subscribe: store.subscribe,
        }),
      )

      expect(value()).toBe(1)
      source = 2
      store.notify()
      expect(value()).toBe(2)
    })

    it('accepts a synchronous notification during computation', () => {
      const store = makeSubscription()
      let shouldNotify = true
      const value = TestBed.runInInjectionContext(() =>
        injectLinkedStoreSignal({
          computation: () => {
            if (shouldNotify) {
              shouldNotify = false
              store.notify()
            }
            return 1
          },
          subscribe: store.subscribe,
        }),
      )

      expect(value()).toBe(1)
      expect(store.subscriberCount()).toBe(1)
    })

    it('subscribes only once across both kinds of invalidation', () => {
      const store = makeSubscription()
      const source = signal(1)
      const subscribe = vi.fn(store.subscribe)
      const value = TestBed.runInInjectionContext(() =>
        injectLinkedStoreSignal({
          computation: () => source(),
          subscribe,
        }),
      )

      expect(value()).toBe(1)
      source.set(2)
      expect(value()).toBe(2)
      store.notify()
      expect(value()).toBe(2)
      expect(subscribe).toHaveBeenCalledOnce()
    })

    it('does not track signals read while installing the subscription', () => {
      const store = makeSubscription()
      const incidental = signal('first')
      const installedWith: Array<string> = []
      const value = TestBed.runInInjectionContext(() =>
        injectLinkedStoreSignal({
          computation: () => 1,
          subscribe: (notify) => {
            installedWith.push(incidental())
            return store.subscribe(notify)
          },
        }),
      )

      expect(value()).toBe(1)
      incidental.set('second')
      expect(value()).toBe(1)
      expect(installedWith).toEqual(['first'])
    })

    it('uses equal to suppress equivalent computations', () => {
      const store = makeSubscription()
      let source = 1
      const value = TestBed.runInInjectionContext(() =>
        injectLinkedStoreSignal({
          computation: () => ({ value: source }),
          subscribe: store.subscribe,
          equal: (previous, next) => previous.value === next.value,
        }),
      )
      const initialValue = value()

      store.notify()
      expect(value()).toBe(initialValue)

      source = 2
      store.notify()
      expect(value()).toEqual({ value: 2 })
      expect(value()).not.toBe(initialValue)
    })

    it('can recover from a failing computation without resubscribing', () => {
      const store = makeSubscription()
      const shouldFail = signal(true)
      const error = new Error('computation failed')
      const subscribe = vi.fn(store.subscribe)
      const value = TestBed.runInInjectionContext(() =>
        injectLinkedStoreSignal({
          computation: () => {
            if (shouldFail()) throw error
            return 1
          },
          subscribe,
        }),
      )

      expect(() => value()).toThrow(error)
      shouldFail.set(false)
      expect(value()).toBe(1)
      expect(subscribe).toHaveBeenCalledOnce()
    })
  })

  describe('cleanup', () => {
    it('unsubscribes and ignores retained callbacks after destruction', () => {
      const store = makeSubscription()
      let source = 1
      const injector = Injector.create({
        providers: [],
        parent: TestBed.inject(Injector),
      })
      const value = runInInjectionContext(injector, () =>
        injectLinkedStoreSignal({
          computation: () => source,
          subscribe: store.subscribe,
        }),
      )

      expect(value()).toBe(1)
      injector.destroy()
      expect(store.subscriberCount()).toBe(0)

      source = 2
      store.notifyRetainedSubscribers()
      expect(value()).toBe(1)
    })
  })
})
