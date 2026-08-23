import {
  NgZone,
  assertInInjectionContext,
  computed,
  inject,
  untracked,
} from '@angular/core'
import {
  MutationObserver,
  QueryClient,
  noop,
  shouldThrowError,
} from '@tanstack/query-core'
import { signalProxy } from './utils/signal-proxy'
import { injectPendingTasksLifecycle } from './utils/inject-pending-tasks-lifecycle'
import { injectReactiveSubscription } from './utils/inject-reactive-subscription'
import type { DefaultError } from '@tanstack/query-core'
import type {
  CreateMutateAsyncFunction,
  CreateMutateFunction,
  CreateMutationOptions,
  CreateMutationResult,
} from './types'

/**
 * Injects a mutation: an imperative function that can be invoked which typically performs server side effects.
 *
 * Unlike queries, mutations are not run automatically.
 * @param optionsFn - A function that returns mutation options.
 * @returns The mutation.
 */
export function injectMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  optionsFn: () => CreateMutationOptions<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  >,
): CreateMutationResult<TData, TError, TVariables, TOnMutateResult> {
  assertInInjectionContext(injectMutation)
  const ngZone = inject(NgZone)
  const queryClient = inject(QueryClient)
  const lifecycle = injectPendingTasksLifecycle()

  /**
   * computed() is used so signals can be inserted into the options
   * making it reactive. Wrapping options in a function ensures embedded expressions
   * are preserved and can keep being applied after signal changes
   */
  const optionsSignal = computed(optionsFn)

  const observerSignal = computed(
    () => new MutationObserver(queryClient, untracked(optionsSignal)),
  )
  let observerHasInitialOptions = false

  const mutationStateSignal = injectReactiveSubscription({
    updateSource: optionsSignal,
    update: (options) => {
      if (!observerHasInitialOptions) {
        observerHasInitialOptions = true
        return
      }
      observerSignal().setOptions(options)
    },
    getSnapshot: () => observerSignal().getCurrentResult(),
    subscribe: (onStoreChange) => {
      const observer = observerSignal()

      const unsubscribe = observer.subscribe((state) => {
        if (lifecycle.destroyed) return

        lifecycle.setPending(state.isPending)

        if (
          state.isError &&
          shouldThrowError(observer.options.throwOnError, [state.error])
        ) {
          ngZone.run(() => {
            ngZone.onError.emit(state.error)
            throw state.error
          })
          return
        }

        onStoreChange()
      })

      return () => {
        lifecycle.setPending(false)
        unsubscribe()
      }
    },
  })

  const mutate: CreateMutateFunction<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  > = (...args) => {
    mutateAsync(...args).catch(noop)
  }

  const mutateAsync: CreateMutateAsyncFunction<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  > = (...args) => {
    mutationStateSignal()
    return observerSignal().mutate(args[0] as TVariables, args[1])
  }

  const reset = () => {
    mutationStateSignal()
    observerSignal().reset()
  }

  return Object.assign(signalProxy(mutationStateSignal), {
    mutate,
    mutateAsync,
    reset,
  }) as unknown as CreateMutationResult<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  >
}
