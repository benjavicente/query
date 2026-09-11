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
 * Injects a signal that tracks whether a restore (e.g. from a persisted client, wired up via
 * `provideIsRestoring`) is currently in progress. {@link injectQuery} and friends also check this internally to
 * avoid race conditions between the restore and initializing queries.
 * @returns A readonly `Signal<boolean>` — `true` while a restore is in progress, `false` otherwise (the
 * default when no `provideIsRestoring` provider is registered).
 */
export function injectIsRestoring() {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    assertInInjectionContext(injectIsRestoring)
  }
  return inject(IS_RESTORING)
}

/**
 * Registers a provider for the restore state read by `injectIsRestoring`. Wire this up wherever you drive a
 * restore yourself — e.g. a persist-client integration — so `injectQuery` and friends can defer subscribing
 * to their observer (avoiding a race with the restore) until the restore signal flips back to `false`.
 * A factory runs once per injector in an Angular injection context.
 * @param isRestoring - A restoration signal or a factory that creates it.
 * @returns A provider for the `isRestoring` signal.
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
