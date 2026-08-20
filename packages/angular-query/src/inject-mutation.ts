import {
  NgZone,
  assertInInjectionContext,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core'
import {
  MutationObserver,
  QueryClient,
  noop,
  notifyManager,
  shouldThrowError,
} from '@tanstack/query-core'
import { signalProxy } from './utils/signal-proxy'
import { injectPendingTasksLifecycle } from './utils/inject-pending-tasks-lifecycle'
import { injectLazyValue } from './utils/inject-lazy-value'
import type { DefaultError, MutationObserverResult } from '@tanstack/query-core'
import type {
  CreateMutateFunction,
  CreateMutationOptions,
  CreateMutationResult,
} from './types'

/**
 * Injects a mutation: an imperative function that can be invoked which typically performs server side effects.
 *
 * Unlike queries, mutations are not run automatically.
 * @param injectMutationFn - A function that returns mutation options.
 * @returns The mutation.
 */
export function injectMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  injectMutationFn: () => CreateMutationOptions<
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
  const optionsSignal = computed(injectMutationFn)

  const lazyObserver = injectLazyValue(
    () => new MutationObserver(queryClient, optionsSignal()),
    (observer) => {
      const unsubscribe = ngZone.runOutsideAngular(() =>
        observer.subscribe(
          notifyManager.batchCalls((state) => {
            ngZone.run(() => {
              if (lifecycle.destroyed) return

              lifecycle.setPending(state.isPending)

              if (
                state.isError &&
                shouldThrowError(observer.options.throwOnError, [state.error])
              ) {
                ngZone.onError.emit(state.error)
                throw state.error
              }

              resultFromSubscriberSignal.set(state)
            })
          }),
        ),
      )
      return () => {
        lifecycle.setPending(false)
        unsubscribe()
      }
    },
  )

  const lazyMutateFn = injectLazyValue<
    CreateMutateFunction<TData, TError, TVariables, TOnMutateResult>
  >(() => {
    const observer = lazyObserver()
    return (variables, mutateOptions) => {
      observer.mutate(variables, mutateOptions).catch(noop)
    }
  })

  /**
   * Computed signal that gets result from mutation cache based on passed options
   */
  const firstResultFromInitialOptionsSignal = computed(() => {
    const observer = lazyObserver()
    return observer.getCurrentResult()
  })

  /**
   * Signal that contains result set by subscriber
   */
  const resultFromSubscriberSignal = signal<MutationObserverResult<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  > | null>(null)

  effect(() => {
    const observer = lazyObserver()
    const observerOptions = optionsSignal()

    untracked(() => {
      observer.setOptions(observerOptions)
    })
  })

  const resultSignal = computed(() => {
    const result =
      resultFromSubscriberSignal() ?? firstResultFromInitialOptionsSignal()

    return {
      ...result,
      mutate: lazyMutateFn(),
      mutateAsync: result.mutate,
    }
  })

  return signalProxy(resultSignal, [
    'mutate',
    'mutateAsync',
    'reset',
  ]) as CreateMutationResult<TData, TError, TVariables, TOnMutateResult>
}
