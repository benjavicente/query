import type { Signal } from '@angular/core'

/* eslint-disable @typescript-eslint/method-signature-style */

// TODO: Replace these local stubs with Angular's public Resource types once the
// Angular 20 experimental Resource API matches the newer stable Resource shape.
export type ResourceStatus =
  | 'idle'
  | 'error'
  | 'loading'
  | 'reloading'
  | 'resolved'
  | 'local'

export type ResourceSnapshot<T> =
  | { readonly status: 'error'; readonly error: Error }
  | {
      readonly status: Exclude<ResourceStatus, 'error'>
      readonly value: T
    }

export interface Resource<T> {
  readonly value: Signal<T>
  readonly status: Signal<ResourceStatus>
  readonly error: Signal<Error | undefined>
  readonly isLoading: Signal<boolean>
  readonly snapshot: Signal<ResourceSnapshot<T>>

  hasValue(this: T extends undefined ? this : never): this is Resource<
    Exclude<T, undefined>
  >

  hasValue(): boolean
}
