import {
  InjectionToken,
  assertInInjectionContext,
  inject,
  isSignal,
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
 * Provides the signal that tracks restoration for persistence or custom integrations.
 * A factory runs once per injector in an Angular injection context.
 * @param isRestoring - A restoration signal or a factory that creates it.
 * @returns Provider for the `isRestoring` signal
 */
export function provideIsRestoring(
  isRestoring: Signal<boolean> | (() => Signal<boolean>),
): Provider {
  return {
    provide: IS_RESTORING,
    ...(isSignal(isRestoring)
      ? { useValue: isRestoring }
      : { useFactory: isRestoring }),
  }
}
