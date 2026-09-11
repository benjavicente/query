- Instance construction & OnDestroy callback registration

> Historical lifecycle investigation. The current implementation uses `injectExternalStore`,
> synchronous observer notifications, per-invocation mutation pending tasks, and a narrow zone entry
> at pending-task release. See [current decisions](ANGULAR-DECISIONS.md#adapter-simplification)
> for the final contract; experimental helpers and alternatives below are retained as research notes.
- First change detection: Inputs and Models are set and ngOnInit is called <- but maybe we want to do it here?
- Effects run <- We are subscribing always here, but maybe in an effect that is too late

1. Calling the signal can fail because input signals might not be ready yet, so we need to delay the read. This is a big issue with components.
2. Using effects for subscriptions might result in a subscription that starts too late. It might be expected before ngOnInit or in an earlier effect. This is an issue when something needs to run as early as possible, which isn't usually the case, but breaks, for example, mutations on the first render of components.
3. The resource-specific cleanup function does not exist until the resource has been initialized. The cleanup should be registered or enabled when the thing is initialized. Usually effects for syncing options initialize the thing, so this isn't an issue in real applications but it might be in tests with really specific conditions.
4. The setup "effect" might have reactive values, and we should be able to react to them. A simple callback with unsubscribe on destroy does not cover the case when that initialization effect depends on other signals. See isRestoring of base query.

Should we guard late reads?

---

# Angular subscriptions

Assuming we have an external class like this:

```ts
type Unsubscribe = () => void

interface Observer<T> {
  constructor(options: Options<T>): Observer<T>
  subscribe(callback: (value: T) => void): Unsubscribe
  setOptions(options: Options<T>): void
  getCurrent(): T
  doSomething(): void // Updates value and calls subscribers
}
```

And the goal is to build an API in Angular like this:

```ts
function injectValue<T>(options: Signal<Options<T>>): {
  value: Signal<T>
  doSomething: () => void
}
```

And noting that the Angular lifecycle that we care about here is:

- Constructor runs
- Component initialization, Inputs and Models are set and ngOnInit is called
- Effects run in order

## 1. Subscribing directly

```ts
function injectObserver(options: Signal<Options<T>>) {
  const destroyRef = inject(DestroyRef)
  const observer = new Observer(options())
  const valueSignal = signal(observer.getCurrent())

  const unsubscribe = observer.subscribe((newValue) => {
    valueSignal.set(newValue)
  })

  destroyRef.onDestroy(() => unsubscribe())

  effect(() => {
    observer.setOptions(options())
  })

  return {
    value: valueSignal,
    doSomething: () => observer.doSomething(),
  }
}
```

This usually breaks because it does not work with input signals, which are set only after component initialization, rather than during construction:

```ts
@Component( ... )
export class ComponentThatPassesInputs {
  options = input.required<Options<T>>();
  // Throws NG0952/NG0950: no model/input available yet on `new Observer(options())`
  value = injectObserver(this.options);
}
```

This issue is present on the Store adapter and every library that does not create a helper to solve this issue.

## 2. Subscribing in an effect

> See [this repository](https://github.com/benjavicente/tanstack-angular-store-input-examples#readme) for where I explored in detail this part.

One trick is to use effects and linked signals to solve the issue, like this:

```ts
function injectObserver(options: Signal<Options<T>>) {
  const observerSignal = computed(() => new Observer(untracked(options)))
  const valueSignal = linkedSignal(() => observerSignal().getCurrent())

  effect((onCleanup) => {
    // Note that this effect runs once
    const unsubscribe = observerSignal().subscribe((newValue) => {
      valueSignal.set(newValue)
    })
    onCleanup(() => unsubscribe())
  })

  effect(() => {
    observerSignal().setOptions(options())
  })

  return {
    value: valueSignal,
    doSomething: () => observerSignal().doSomething(),
  }
}
```

This solves the input issue and generally works great for most cases, but it can suffer from a race condition issue like here:

```ts
@Component( ... )
export class ComponentThatDoesSomethingBeforeSubscribe implements OnInit {
  options = input.required<Options<T>>();

  earlierEffect = effect(() => {
    // Registering an effect before the injectObserver effects
    this.value.doSomething()
  })

  value = injectObserver(this.options);

  ngOnInit() {
    // Doing something after inputs are ready but before effects
    this.value.doSomething()
  }
}
```

So using effects for subscribing can lead to timing errors when something is called eagerly.

Adapters that return something that allows mutating the state on the returned object could be affected, like Query ([#9020](https://github.com/TanStack/query/issues/9020)).

## 3. Workaround with a lazy factory

Instead of subscribing in an effect, we could subscribe to it on first read. Here is a helper for that:

```ts
const sentinel = Symbol()

export function injectLazyValue<T>(
  factory: () => T,
  effectWithUnsubscribe: (value: T) => Unsubscribe,
): () => T {
  const destroyRef = inject(DestroyRef)
  let value: T | typeof sentinel = sentinel

  return () => {
    if (value === sentinel) {
      // We shouldn't subscribe or register on destroy if the component is destroyed
      if (destroyRef.destroyed) {
        throw new Error("Can't initialize object if parent is destroyed")
      }

      // Do not track in current context
      value = untracked(() => {
        const val = factory()
        destroyRef.onDestroy(effectWithUnsubscribe(val))
        return val
      })
    }
    return value
  }
}
```

And it could be used like this:

```ts
function injectObserver(options: Signal<Options<T>>) {
  const lazyObserver = injectLazyValue(
    () => new Observer(untracked(options)),
    // Note that this function runs once
    (observer) => {
      const unsubscribe = observer.subscribe((newValue) => {
        valueSignal.set(newValue)
      })
      return () => {
        unsubscribe()
      }
    },
  )

  const valueSignal = linkedSignal(() => lazyObserver().getCurrent())

  effect(() => {
    lazyObserver().setOptions(options())
  })

  return {
    value: valueSignal,
    doSomething: () => lazyObserver().doSomething(),
  }
}
```

With that change, the lazyObserver will be created when the effect runs, or can be initialized earlier like when `doSomething()` is called on an earlier effect and on `ngOnInit`.

The Table adapter solves this issue.

## 4. What if the effect of the factory is reactive

Going back to 2, what if instead of an effect that runs once, we had:

```ts
function injectObserver(options: Signal<Options<T>>) {
  const observerSignal = computed(() => new Observer(untracked(options)))
  const valueSignal = linkedSignal(() => observerSignal().getCurrent())
  const isRestoring = injectIsRestoring()

  effect((onCleanup) => {
    // Now the effect will run again when isRestoring changes
    if (isRestoring()) return

    const unsubscribe = observerSignal().subscribe((newValue) => {
      valueSignal.set(newValue)
    })
    onCleanup(() => unsubscribe())
  })

  effect(() => {
    observerSignal().setOptions(options())
  })

  return {
    value: valueSignal,
    doSomething: () => observerSignal().doSomething(),
  }
}
```

Assuming we have eager effects in Angular, like Vue's [Eager Watcher](https://vuejs.org/guide/essentials/watchers.html#eager-watchers), we could change the utility to be like this:

```ts
const sentinel = Symbol()

export function injectLazyValue<T>(
  factory: () => T,
  effectWithUnsubscribe: (value: T) => Unsubscribe,
): () => T {
  const destroyRef = inject(DestroyRef)
  const injector = inject(Injector)
  let value: T | typeof sentinel = sentinel

  return () => {
    if (value === sentinel) {
      // We shouldn't subscribe or register on destroy if the component is destroyed
      if (destroyRef.destroyed) {
        throw new Error("Can't initialize object if parent is destroyed")
      }

      // Do not track the factory
      value = untracked(factory)
      effect(
        (onCleanup) => {
          const cleanup = effectWithUnsubscribe(value)
          onCleanup(cleanup)
        },
        // Run the effect immediately on first read,
        // but immediate isn't a real option
        { injector, immediate: true },
      )
    }
    return value
  }
}
```

And this would work:

```ts
function injectObserver(options: Signal<Options<T>>) {
  const isRestoring = injectIsRestoring()

  const lazyObserver = injectLazyValue(
    () => new Observer(untracked(options)),
    (observer) => {
      if (isRestoring()) return

      return observer.subscribe((newValue) => {
        valueSignal.set(newValue)
      })
    },
  )

  const valueSignal = linkedSignal(() => lazyObserver().getCurrent())

  effect(() => {
    lazyObserver().setOptions(options())
  })

  return {
    value: valueSignal,
    doSomething: () => lazyObserver().doSomething(),
  }
}
```

But sadly we can't, and I haven't found a clean solution to this.
Here is my workaround for that case, using a `lazyValue` that runs the function in an injection context instead of an effect:

```ts
const lazyObserver = injectLazyValue(
  () => new Observer(untracked(options)),
  (observer) => {
    let unsubscribe: CleanupFn | undefined

    function sync(shouldSubscribe: boolean) {
      if (shouldSubscribe && !unsubscribe) {
        unsubscribe = observer.subscribe((newValue) => {
          valueSignal.set(newValue)
        })
      } else if (!shouldSubscribe && unsubscribe) {
        unsubscribe()
        unsubscribe = undefined
      }
    }

    sync(!untracked(isRestoring))

    effect(() => {
      // In theory, isRestoring could change between the first sync and any other
      // effect that would run earlier, but in practice that isn't the case.
      // Eager effects wouldn't have an issue since they should react immediately
      const shouldSubscribe = !isRestoring()
      untracked(() => {
        sync(shouldSubscribe)
      })
    })

    return () => sync(false)
  },
)
```
