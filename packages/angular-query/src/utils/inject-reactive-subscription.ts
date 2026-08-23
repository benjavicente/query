import {
  computed,
  effect,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core'
import { injectDestroyRefCompat } from './destroy-ref-compat'
import type { Signal } from '@angular/core'

export type CleanupFn = () => void
export type Subscribe = (onStoreChange: () => void) => CleanupFn

function createTransitionScope() {
  let transitionDepth = 0

  return function createTransitionState() {
    let localTransitionDepth = 0

    return {
      get transitioning() {
        return localTransitionDepth > 0
      },
      get transitionDepth() {
        return transitionDepth
      },
      runTransition<T>(transition: () => T): T {
        localTransitionDepth++
        transitionDepth++

        try {
          return transition()
        } finally {
          transitionDepth--
          localTransitionDepth--
        }
      },
    }
  }
}

const createTransitionState = createTransitionScope()

interface ReactiveSubscriptionBaseOptions<TState> {
  /** Subscribes to the external store. */
  subscribe: Subscribe
  /** Controls exceptional cases where the store must not be subscribed. */
  shouldSubscribe?: Signal<boolean>
  /** Reads the current value from the external store. */
  getSnapshot: () => TState
  /** Defers initialization until the returned signal is first read. */
  lazy?: boolean
}

export interface ReactiveSubscriptionWithoutUpdateOptions<
  TState,
> extends ReactiveSubscriptionBaseOptions<TState> {
  updateSource?: never
  update?: never
}

export interface ReactiveSubscriptionWithUpdateOptions<
  TUpdate,
  TState,
> extends ReactiveSubscriptionBaseOptions<TState> {
  /** Reactive value used to configure the current external store. */
  updateSource: Signal<TUpdate>
  /** Configures the external store without owning its identity. */
  update?: (source: TUpdate) => void
}

export type InjectReactiveSubscriptionOptions<TUpdate, TState> =
  | ReactiveSubscriptionWithoutUpdateOptions<TState>
  | ReactiveSubscriptionWithUpdateOptions<TUpdate, TState>

const noUpdateSource = Symbol('no update source')

interface SubscriptionFrame<TState> {
  snapshot: TState
  token: symbol
}

interface Notification {
  token: symbol
}

export function injectReactiveSubscription<TState>(
  options: ReactiveSubscriptionWithoutUpdateOptions<TState>,
): Signal<TState>

export function injectReactiveSubscription<TUpdate, TState>(
  options: ReactiveSubscriptionWithUpdateOptions<TUpdate, TState>,
): Signal<TState>

export function injectReactiveSubscription<TUpdate, TState>(
  options: InjectReactiveSubscriptionOptions<TUpdate, TState>,
): Signal<TState> {
  const destroyRef = injectDestroyRefCompat()
  const transitionState = createTransitionState()
  const { getSnapshot, subscribe, shouldSubscribe, lazy = false } = options
  const withUpdateOptions =
    options.updateSource === undefined ? undefined : options
  const updateSource = withUpdateOptions?.updateSource

  let unsubscribe: CleanupFn | undefined
  let subscriptionToken = Symbol('uninitialized subscription')
  let currentToken = Symbol('uninitialized subscription')

  const notification = signal<Notification | undefined>(undefined)

  function stopSubscription() {
    const cleanup = unsubscribe
    unsubscribe = undefined
    subscriptionToken = Symbol('stopped subscription')
    cleanup?.()
  }

  destroyRef.onDestroy(() => {
    stopSubscription()
  })

  const notify = (token: symbol) => {
    if (transitionState.transitioning || destroyRef.destroyed) return
    if (token !== subscriptionToken) return
    if (transitionState.transitionDepth > 0) {
      queueMicrotask(() => notify(token))
      return
    }

    notification.set({ token: currentToken })
  }

  function ensureSubscribed() {
    if (!unsubscribe) {
      const token = Symbol('subscription')
      subscriptionToken = token
      try {
        unsubscribe = untracked(() => subscribe(() => notify(token)))
      } catch (error) {
        unsubscribe = undefined
        subscriptionToken = Symbol('failed subscription')
        throw error
      }
    }
  }

  const updateFrame = linkedSignal<TUpdate | typeof noUpdateSource, symbol>({
    source: () => (updateSource ? updateSource() : noUpdateSource),
    computation: (nextUpdateSource, previous) => {
      if (destroyRef.destroyed) {
        if (previous) return previous.value
        throw new Error('Cannot initialize a subscription after destruction')
      }

      return transitionState.runTransition(() => {
        const update = withUpdateOptions?.update
        if (update && nextUpdateSource !== noUpdateSource) {
          untracked(() => update(nextUpdateSource))
        }

        return Symbol('update frame')
      })
    },
  })

  const subscriptionFrame = linkedSignal<
    readonly [symbol, boolean],
    SubscriptionFrame<TState>
  >({
    source: () => [updateFrame(), shouldSubscribe?.() ?? true] as const,
    computation: ([, subscribeNow], previous) => {
      if (destroyRef.destroyed) {
        if (previous) return previous.value
        throw new Error('Cannot initialize a subscription after destruction')
      }

      const token = Symbol('subscription frame')
      currentToken = token
      return transitionState.runTransition(() => {
        if (subscribeNow) ensureSubscribed()
        else stopSubscription()

        let snapshot: TState
        try {
          snapshot = untracked(getSnapshot)
        } catch (error) {
          try {
            stopSubscription()
          } catch {
            // Cleanup errors cannot make a failed snapshot usable.
          }
          throw error
        }

        return { snapshot, token }
      })
    },
  })

  const value = computed(() => {
    const frame = subscriptionFrame()
    const latestNotification = notification()

    return latestNotification?.token === frame.token
      ? untracked(getSnapshot)
      : frame.snapshot
  })

  if (!lazy) {
    effect(() => subscriptionFrame())
  }

  return value
}
