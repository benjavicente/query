import {
  InjectionToken,
  assertInInjectionContext,
  inject,
  signal,
} from '@angular/core'
import type { Provider, Signal } from '@angular/core'

/**
 * Internal token used to track isRestoring state, accessible in public API through `injectIsRestoring` and set via `provideIsRestoring`
 */
const IS_RESTORING = new InjectionToken('', {
  // Default value when not provided
  factory: () => signal(false).asReadonly(),
})

/**
 * Injects a signal that tracks whether a restore is currently in progress. {@link injectQuery} and friends also check this internally to avoid race conditions between the restore and initializing queries.
 * @returns readonly signal with boolean that indicates whether a restore is in progress.
 */
export function injectIsRestoring() {
  assertInInjectionContext(injectIsRestoring)
  return inject(IS_RESTORING)
}

/**
 * Used by TanStack Query Angular persist client plugin to provide the signal that tracks the restore state
 * @param isRestoring - a readonly signal that returns a boolean
 * @returns Provider for the `isRestoring` signal
 */
export function provideIsRestoring(isRestoring: Signal<boolean>): Provider {
  return {
    provide: IS_RESTORING,
    useValue: isRestoring,
  }
}
