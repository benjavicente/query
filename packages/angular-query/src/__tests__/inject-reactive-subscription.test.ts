import {
  ApplicationRef,
  Injector,
  provideZonelessChangeDetection,
  runInInjectionContext,
  signal,
} from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { injectReactiveSubscription } from '../utils/inject-reactive-subscription'

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

describe('injectReactiveSubscription', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    })
  })

  describe('initialization', () => {
    it('returns an initial snapshot before effects run', () => {
      const source = makeSource(1)
      const value = TestBed.runInInjectionContext(() =>
        injectReactiveSubscription({
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
        injectReactiveSubscription({
          getSnapshot: source.get,
          subscribe: source.subscribe,
        }),
      )

      await TestBed.inject(ApplicationRef).whenStable()
      expect(source.subscriberCount()).toBe(1)
    })

    it('defers a lazy subscription until its first read', async () => {
      const source = makeSource(1)
      const value = TestBed.runInInjectionContext(() =>
        injectReactiveSubscription({
          lazy: true,
          getSnapshot: source.get,
          subscribe: source.subscribe,
        }),
      )

      await TestBed.inject(ApplicationRef).whenStable()
      expect(source.subscriberCount()).toBe(0)
      expect(value()).toBe(1)
      expect(source.subscriberCount()).toBe(1)
    })
  })

  describe('snapshots and updates', () => {
    it('reads notifications synchronously', () => {
      const source = makeSource(1)
      const value = TestBed.runInInjectionContext(() =>
        injectReactiveSubscription({
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
        injectReactiveSubscription({
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
        injectReactiveSubscription({
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
        injectReactiveSubscription({
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
  })

  describe('subscription', () => {
    it('uses shouldSubscribe for exceptional subscription gates', () => {
      const source = makeSource(1)
      const shouldSubscribe = signal(false)
      const subscribe = vi.fn(source.subscribe)
      const value = TestBed.runInInjectionContext(() =>
        injectReactiveSubscription({
          shouldSubscribe,
          getSnapshot: source.get,
          subscribe,
        }),
      )

      expect(value()).toBe(1)
      expect(subscribe).not.toHaveBeenCalled()

      source.set(2)
      shouldSubscribe.set(true)
      expect(value()).toBe(2)
      expect(subscribe).toHaveBeenCalledOnce()

      shouldSubscribe.set(false)
      expect(value()).toBe(2)
      expect(source.subscriberCount()).toBe(0)
    })

    it('does not track signals read while installing the subscription', () => {
      const source = makeSource(1)
      const incidental = signal('first')
      const installedWith: Array<string> = []
      const value = TestBed.runInInjectionContext(() =>
        injectReactiveSubscription({
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
  })

  describe('cleanup and failures', () => {
    it('cleans up and ignores notifications after destruction', () => {
      const source = makeSource(1)
      const injector = Injector.create({
        providers: [],
        parent: TestBed.inject(Injector),
      })
      const value = runInInjectionContext(injector, () =>
        injectReactiveSubscription({
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
        injectReactiveSubscription({
          getSnapshot: () => {
            throw error
          },
          subscribe: source.subscribe,
        }),
      )

      expect(() => value()).toThrow(error)
      expect(source.subscriberCount()).toBe(0)
    })
  })
})
