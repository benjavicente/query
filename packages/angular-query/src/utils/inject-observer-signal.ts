import { effect, linkedSignal, signal, untracked } from '@angular/core'
import { injectDestroyRefCompat } from './destroy-ref-compat'
import type { Signal } from '@angular/core'

export type CleanupFn = () => void
export type Subscribe = (onStoreChange: () => void) => CleanupFn | undefined

interface Subscription {
  cleanup?: CleanupFn
}

export interface ObserverSignalOptions<TUpdate, TState> {
  /**
   * Subscribes to the external store. Returning `undefined` defers installation
   * until the next update frame.
   */
  subscribe: Subscribe
  /** Reads the current value from the external store. */
  getSnapshot: () => TState
  /**
   * Reactive value used to configure the current external store.
   * Used to know when the store could change eagerly.
   **/
  updateSource: Signal<TUpdate>
  /**
   * Configures the external store without owning its identity.
   * Takes the update source and updates the store eagerly.
   */
  update?: (source: TUpdate) => void
}

export function injectObserverSignal<TUpdate, TState>(
  options: ObserverSignalOptions<TUpdate, TState>,
): Signal<TState> {
  const destroyRef = injectDestroyRefCompat()
  const { getSnapshot, subscribe, update, updateSource } = options

  let subscription: Subscription | undefined
  // Observer subscriptions can notify synchronously while an update or initial
  // subscription is in progress. Route that notification through the graph to
  // avoid a reentrant write to the linked value.
  const storeChanged = signal(false)

  function stopSubscription() {
    const currentSubscription = subscription
    subscription = undefined
    currentSubscription?.cleanup?.()
  }

  destroyRef.onDestroy(stopSubscription)

  const notify = (notifyingSubscription: Subscription) => {
    untracked(() => {
      if (destroyRef.destroyed || notifyingSubscription !== subscription) {
        return
      }

      storeChanged.update((changed) => !changed)
    })
  }

  function ensureSubscribed() {
    if (!subscription) {
      const nextSubscription: Subscription = {}
      subscription = nextSubscription

      try {
        const cleanup = untracked(() =>
          subscribe(() => notify(nextSubscription)),
        )
        if (cleanup) nextSubscription.cleanup = cleanup
        else if (subscription === nextSubscription) subscription = undefined
      } catch (error) {
        if (subscription === nextSubscription) subscription = undefined
        throw error
      }
    }
  }

  const updateFrame = linkedSignal<TUpdate, boolean>({
    source: updateSource,
    computation: (nextUpdateSource, previous) => {
      if (destroyRef.destroyed) {
        if (previous) return previous.value
        throw new Error('Cannot initialize a subscription after destruction')
      }

      if (update) {
        untracked(() => update(nextUpdateSource))
      }

      return !previous?.value
    },
  })

  const value = linkedSignal<void, TState>({
    source: () => {
      updateFrame()
      storeChanged()
    },
    computation: (_, previous) => {
      if (destroyRef.destroyed) {
        if (previous) return previous.value
        throw new Error('Cannot initialize a subscription after destruction')
      }

      ensureSubscribed()

      try {
        return untracked(getSnapshot)
      } catch (error) {
        try {
          stopSubscription()
        } catch {
          // Cleanup errors cannot make a failed snapshot usable.
        }
        throw error
      }
    },
  })

  // Signals are lazy but TanStack subscriptions are not
  // Initialized the signal at least before end of change detection
  effect(() => value())

  return value.asReadonly()
}
