import {
  Component,
  EnvironmentInjector,
  createEnvironmentInjector,
  input,
  inputBinding,
  runInInjectionContext,
  signal,
} from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { injectExternalStore } from '../inject-external-store'
import { provideAngularQueryChangeDetection } from '../../__tests__/test-utils'

function store(initial: number) {
  let value = initial
  const listeners = new Set<() => void>()
  const retained: Array<() => void> = []
  const subscribe = vi.fn((notify: () => void) => {
    listeners.add(notify)
    retained.push(notify)
    return () => listeners.delete(notify)
  })
  return {
    subscribe,
    retained,
    set(next: number) {
      value = next
      listeners.forEach((notify) => notify())
    },
    getSnapshot: () => value,
  }
}

describe('injectExternalStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAngularQueryChangeDetection()],
    })
  })

  it('activates synchronously for required inputs and imperative reads', () => {
    const source = store(1)
    @Component({ template: '' })
    class Example {
      readonly source = input.required<ReturnType<typeof store>>()
      readonly value = injectExternalStore(() => {
        const currentSource = this.source()
        return {
          getSnapshot: () => currentSource.getSnapshot(),
          subscribe: (notify) => currentSource.subscribe(notify),
        }
      })
      seen: Array<number> = []
      ngOnInit() {
        this.seen.push(this.value())
        this.source().set(2)
        this.seen.push(this.value())
      }
    }

    const fixture = TestBed.createComponent(Example, {
      bindings: [inputBinding('source', () => source)],
    })
    fixture.detectChanges()
    expect(fixture.componentInstance.seen).toContain(1)
    expect(fixture.componentInstance.seen).toContain(2)
    expect(source.subscribe).toHaveBeenCalledOnce()
  })

  it('tracks selector dependencies introduced by external notifications', () => {
    const source = store(0)
    const multiplier = signal(10)
    const value = TestBed.runInInjectionContext(() =>
      injectExternalStore(() => ({
        getSnapshot: () => (source.getSnapshot() > 0 ? multiplier() : 0),
        subscribe: (notify) => source.subscribe(notify),
      })),
    )

    expect(value()).toBe(0)
    source.set(1)
    expect(value()).toBe(10)
    multiplier.set(20)
    expect(value()).toBe(20)
  })

  it('pauses observation and catches up when resumed', () => {
    const source = store(1)
    const paused = signal(false)
    const value = TestBed.runInInjectionContext(() =>
      injectExternalStore(() => ({
        getSnapshot: source.getSnapshot,
        subscribe: paused() ? undefined : source.subscribe,
      })),
    )

    expect(value()).toBe(1)
    paused.set(true)
    TestBed.tick()
    expect(value()).toBe(1)
    source.set(2)
    source.retained[0]!()
    expect(value()).toBe(1)
    paused.set(false)
    TestBed.tick()
    expect(value()).toBe(2)
  })

  it('replaces bindings and retires the old callback', () => {
    const first = store(1)
    const second = store(10)
    const requested = signal(first)
    const value = TestBed.runInInjectionContext(() =>
      injectExternalStore(() => requested()),
    )

    expect(value()).toBe(1)
    requested.set(second)
    expect(value()).toBe(10)
    TestBed.tick()
    expect(value()).toBe(10)
    expect(first.subscribe.mock.results[0]!.value).toBeTypeOf('function')
    first.set(2)
    expect(value()).toBe(10)
    second.set(11)
    expect(value()).toBe(11)
  })

  it('retries failed installation after the binding factory changes', () => {
    const source = store(1)
    const retry = signal(0)
    let fail = true
    const value = TestBed.runInInjectionContext(() =>
      injectExternalStore(() => {
        retry()
        return {
          getSnapshot: source.getSnapshot,
          subscribe: (notify: () => void) => {
            if (fail) throw new Error('subscribe failed')
            return source.subscribe(notify)
          },
        }
      }),
    )

    expect(() => value()).toThrow('subscribe failed')
    fail = false
    retry.set(1)
    TestBed.tick()
    expect(value()).toBe(1)
  })

  it('reads post-install state when subscription notifies immediately', () => {
    const source = store(1)
    const value = TestBed.runInInjectionContext(() =>
      injectExternalStore(() => ({
        getSnapshot: source.getSnapshot,
        subscribe: (notify) => {
          source.set(2)
          notify()
          return source.subscribe(notify)
        },
      })),
    )
    expect(value()).toBe(2)
  })

  it('recovers from a snapshot error without resubscribing', () => {
    const source = store(1)
    const getSnapshot = vi.fn(() => {
      if (source.getSnapshot() === 2) throw new Error('snapshot failed')
      return source.getSnapshot()
    })
    const value = TestBed.runInInjectionContext(() =>
      injectExternalStore(() => ({
        getSnapshot,
        subscribe: (notify) => source.subscribe(notify),
      })),
    )
    expect(value()).toBe(1)
    source.set(2)
    expect(() => value()).toThrow('snapshot failed')
    source.set(3)
    expect(value()).toBe(3)
    expect(source.subscribe).toHaveBeenCalledOnce()
  })

  it('cleans up when destruction occurs during installation', () => {
    const injector = createEnvironmentInjector(
      [],
      TestBed.inject(EnvironmentInjector),
    )
    const cleanup = vi.fn()
    const value = runInInjectionContext(injector, () =>
      injectExternalStore(() => ({
        getSnapshot: () => 1,
        subscribe: () => {
          injector.destroy()
          return cleanup
        },
      })),
    )
    expect(value()).toBe(1)
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('permits a detached snapshot after destruction without reconnecting', () => {
    const source = store(1)
    const injector = createEnvironmentInjector(
      [],
      TestBed.inject(EnvironmentInjector),
    )
    const value = runInInjectionContext(injector, () =>
      injectExternalStore(() => source),
    )
    expect(value()).toBe(1)
    injector.destroy()
    source.set(2)
    expect(value()).toBe(2)
    source.set(3)
    expect(value()).toBe(2)
    expect(source.subscribe).toHaveBeenCalledOnce()
  })
})
