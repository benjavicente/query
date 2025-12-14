import { computed, untracked } from '@angular/core'
import type { Signal } from '@angular/core'

/**
 * Reactive proxy type that wraps the input type.
 * Note: This type cannot be destructured on component initialization as it would break reactivity.
 * Always access properties directly on the proxy object (e.g., `proxy.field` not `const { field } = proxy`).
 */
export type ReactiveProxy<T> = T

/**
 * Exposes fields of an object passed via an Angular `Signal` as reactive values.
 * Functions on the object are passed through as-is, bound to the current reactive state.
 * @param inputSignal - `Signal` that must return an object.
 * @returns A proxy object with the same fields as the input object, where properties return values directly (like Svelte/Solid/Vue).
 * @remarks This proxy cannot be destructured on component initialization as it would break reactivity.
 * Always access properties directly on the returned proxy object.
 */
export function signalProxy<TInput extends Record<string | symbol, any>>(
  inputSignal: Signal<TInput>,
) {
  const computedCache = new Map<PropertyKey, () => any>()

  return new Proxy({} as ReactiveProxy<TInput>, {
    get(_target, prop) {
      let targetField: any
      try {
        targetField = untracked(inputSignal)[prop]
      } catch (error) {
        if (error instanceof Error && /NG0950/.test(error.message)) {
          throw new Error(EARLY_INPUT_ERROR, { cause: error })
        }
        throw error
      }
      if (typeof targetField === 'function') {
        return function (this: any, ...args: any[]) {
          const currentState = inputSignal()
          return targetField.apply(currentState, args)
        }
      }

      if (!computedCache.has(prop)) {
        computedCache.set(
          prop,
          computed(() => inputSignal()[prop]),
        )
      }
      const computedSignal = computedCache.get(prop)!
      return computedSignal()
    },
    has(_, prop) {
      return !!untracked(inputSignal)[prop]
    },
    ownKeys() {
      return Reflect.ownKeys(untracked(inputSignal))
    },
    getOwnPropertyDescriptor() {
      return {
        enumerable: true,
        configurable: true,
      }
    },
  })
}

const EARLY_INPUT_ERROR =
  'signalProxy: Dependant input of proxy state is not yet initialized (NG0950). Do not destructure the result before component or directive initialization.'
