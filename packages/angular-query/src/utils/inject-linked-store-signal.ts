import { linkedSignal, signal, untracked } from '@angular/core'
import { injectDestroyRefCompat } from './destroy-ref-compat'
import type { Signal, ValueEqualityFn } from '@angular/core'

export interface LinkedStoreSignalOptions<TValue> {
  /** Computes the current value and tracks any Angular signals it reads. */
  computation: () => TValue
  /** Subscribes once to the external invalidation source. */
  subscribe: (onStoreChange: () => void) => () => void
  /** Determines whether a new computed value should invalidate consumers. */
  equal?: ValueEqualityFn<TValue>
}

/**
 * Creates a reactive value backed by one eager external subscription.
 *
 * External notifications and Angular signals read by `computation` invalidate
 * the same linked signal. The subscription itself is installed untracked and
 * remains active until the injection context is destroyed.
 */
export function injectLinkedStoreSignal<TValue>({
  computation,
  subscribe,
  equal,
}: LinkedStoreSignalOptions<TValue>): Signal<TValue> {
  const destroyRef = injectDestroyRefCompat()
  // Keep store invalidations in the reactive source graph. Writing a computed
  // value directly would not refresh dynamic Angular dependencies, and an
  // immediate subscription callback could evaluate required inputs too early.
  const storeChanged = signal(false)

  const unsubscribe = untracked(() =>
    subscribe(() =>
      untracked(() => {
        if (!destroyRef.destroyed) {
          storeChanged.update((changed) => !changed)
        }
      }),
    ),
  )

  destroyRef.onDestroy(unsubscribe)

  const value = linkedSignal(
    () => {
      storeChanged()
      return computation()
    },
    { equal },
  )

  return value.asReadonly()
}
