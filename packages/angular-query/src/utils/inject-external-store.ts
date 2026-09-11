import {
  DestroyRef,
  assertInInjectionContext,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core'
import type { Signal, ValueEqualityFn } from '@angular/core'

interface ExternalBinding<T> {
  /** Synchronous snapshot. Angular signals read here are tracked dependencies. */
  readonly getSnapshot: () => T
  /** Omit to pause observation; changing eligibility requires a new descriptor. */
  readonly subscribe?: ((notify: () => void) => () => void) | undefined
}

interface ExternalStoreOptions<T> {
  /** Snapshot equality, defaulting to Object.is. Does not control connection identity. */
  readonly equal?: ValueEqualityFn<T> | undefined
}

interface Connection<T> {
  binding: ExternalBinding<T>
  ready: boolean
  cleanup?: (() => void) | undefined
}

/**
 * Creates a readonly Angular signal backed by a synchronous external store.
 *
 * @param binding Lazy, memoized factory describing the source and subscription.
 * @param options Optional snapshot equality.
 * @returns A readonly Angular computed signal from the subscribed store.
 *
 * @remarks
 * **Activation and freshness.** An effect also activates bindings
 * and reconciles later source/eligibility changes without eagerly evaluating
 * snapshots. A read can activate the binding before the effect runs.
 *
 * **Recursive reads are unsupported.** The factory, subscription setup/cleanup,
 * snapshot reader, and synchronous code they invoke must not read the returned
 * signal, directly or through another computed depending on it.
 *
 * **Pausing and destruction.** Omitting `subscribe` pauses external observation
 * but retains the snapshot reader. Resuming catches up before returning a value.
 *
 * **Errors.** Factory and installation failures are cached and exposed on value
 * reads. A factory dependency change retries installation, even with the same
 * descriptor. Snapshot failures keep a valid subscription; another notification
 * or tracked snapshot dependency change can recover.
 *
 * @example
 * ```ts
 * const count = injectExternalStore(() => ({
 *   getSnapshot: () => counter.get().count,
 *   subscribe: notify => {
 *     const subscription = counter.subscribe(notify);
 *     return () => subscription.unsubscribe();
 *   },
 * }));
 * ```
 *
 * @example
 * ```ts
 * const selected = injectExternalStore(() => {
 *   const current = source();
 *   return {
 *     getSnapshot: () => current.get() * multiplier(),
 *     subscribe: paused() ? undefined : notify => current.subscribe(notify),
 *   };
 * });
 * ```
 */
export function injectExternalStore<T>(
  binding: () => ExternalBinding<T>,
  options?: ExternalStoreOptions<T>,
): Signal<T> {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    assertInInjectionContext(injectExternalStore)
  }
  const owner = inject(DestroyRef)
  const revision = signal(0)
  const destroyed = signal(false)
  let connection: Connection<T> | undefined

  const invalidate = () => untracked(() => revision.update((n) => n + 1))

  function dispose(cleanup: (() => void) | undefined) {
    try {
      untracked(() => cleanup?.())
    } catch {
      // A failed unsubscribe must not prevent adopting the next source.
      // The retired connection's callbacks have already been disabled.
    }
  }

  function retire() {
    const previous = connection
    connection = undefined
    dispose(previous?.cleanup)
  }

  function reconcile(next: ExternalBinding<T>) {
    // Destruction prevents resource acquisition, not snapshot computation.
    if (destroyed() || (connection?.binding === next && connection.ready))
      return

    retire()
    // Cleanup is external code and can itself destroy the owner.
    if (destroyed()) return
    const candidate: Connection<T> = { binding: next, ready: false }
    connection = candidate
    try {
      const cleanup = next.subscribe?.(() => {
        // Object identity is the connection token. An installation callback
        // needs no invalidation: the first snapshot has not been read yet.
        if (candidate.ready && connection === candidate) invalidate()
      })
      // subscribe may destroy the owner before returning. The destroy callback
      // could not run this cleanup yet, so release it as soon as it is available.
      if (destroyed()) {
        dispose(cleanup)
        return
      }
      candidate.cleanup = cleanup
      candidate.ready = true
    } catch (error) {
      connection = undefined
      throw error
    }
  }

  const connected = computed(
    () => {
      destroyed()
      // Factory dependencies directly invalidate connection setup, including a
      // cached installation error when the factory returns the same descriptor.
      const next = binding()
      untracked(() => reconcile(next))
      return next
    },
    { equal: () => false },
  )

  owner.onDestroy(() => {
    // Also invalidates a cached installation error: detached reads need only a
    // valid snapshot, not a successful subscription. It does not start polling.
    untracked(() => destroyed.set(true))
    retire()
  })

  const value = computed(
    () => {
      const current = connected()
      revision()
      return current.getSnapshot()
    },
    options?.equal ? { equal: options.equal } : undefined,
  )

  effect(() => {
    try {
      connected()
    } catch {
      // The computed retains the error for value reads. A later factory
      // dependency change retries installation.
    }
  })

  return value
}
