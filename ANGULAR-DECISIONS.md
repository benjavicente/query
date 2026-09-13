# Angular Adapter Decisions

## Bug fixes included

### Lazy initializing signals

Reactive values from `injectQuery` and `injectMutation` do not immediately initialize the query observer. This allows consumers to create aliases without runtime errors

```ts
// Query observer isn't initialized until the signal is read for the
// first time, so no error on early input/model initialization is thrown
injectQuery(...).data
```

### Proper pending tasks support

The adapter eagerly registers a pending task while an observed query is fetching.
This also covers invalidation refetches: `QueryObserver` notifies its listeners
synchronously during query dispatch, so no second `QueryCache` subscription is
needed. The tests cover both the normal `await invalidateQueries()` flow and an
invalidation held open while `ApplicationRef.whenStable()` remains pending.

## Changes

### Minimum Angular version: 20.1

Breaking change

Angular 20.1 is the supported minimum for the adapter, devtools, and persistence packages.
The implementation uses native `DestroyRef.destroyed`, `PendingTasks`, and after-render APIs.
The `DestroyRefCompat` shim and its internal exports have been removed.

### What `provideTanStackQuery` accepts

Breaking change.

`provideTanStackQuery` accepted a Query Client and an Injection Token that holds a Query Client.
Passing a Query Client directly creates a pitfall for SSR applications, since the Query Client would end up easily shared between requests.
So instead, the adapter allows a factory function that runs in the injection (so it can call `inject`) context or an Injection Token to avoid that pitfall.

```ts
// Old
provideTanStackQuery(new QueryClient())
// New
provideTanStackQuery(() => new QueryClient())
```

Removed `provideAngularQuery` in favor of `provideTanStackQuery`.
Removed `injectQueryClient` in favor of `inject(QueryClient)`.

### `provideTanStackQuery` returns an `EnvironmentProviders`

Breaking change.

`provideTanStackQuery` was allowed in element injectors (`@Component` and `@Directive` providers)
It used the deprecated [`APP_INITIALIZER`](https://angular.dev/api/core/APP_INITIALIZER#description).
The adapter now uses `provideEnvironmentInitializer`, which runs for each environment injector,
including route injectors. It returns an environment provider, not an element provider.
With the [`makeEnvironmentProviders`](https://angular.dev/api/core/makeEnvironmentProviders) API, we can group what needs to be setup for Query in a single EnvironmentProviders.

```ts
// Old - providing Query in a component or directive was allowed
@Component({
  providers: [provideTanStackQuery(...)]
})
// New - provider should be given in the app config or router providers
// https://angular.dev/api/core/ApplicationConfig#providers
// https://angular.dev/api/router/Route#providers
export const appConfig: ApplicationConfig = {
  providers: [
    provideTanStackQuery(...),
  ],
}
```

### Devtools is a separate package

Breaking change.

Devtools comes with a large install cost, which other adapters make optional.
Even when the devtools core package is marked as optional, most (pnpm, npm) package managers download them anyway without including `--no-optional`.
The initial movement from a separate package was to improve tree-shaking, but that can be achieved in a separate package without issues.
Having the entrypoint for devtools in the same package could give false expectations that no other package would be installed or required, when `@tanstack/query-devtools` was installed by default anyway. This uses the same ideas as other adapters.

```ts
// Old - devtools in the same package
import { withDevtools } from '@tanstack/angular-query-experimental/devtools'
// New - package for devtools
import { withDevtools } from '@benjavicente/angular-query-devtools'
```

The Angular adapter statically imports the devtools implementation, matching the
other framework adapters. The package keeps the automatic development/default
conditions and also exposes stable subpaths for webpack, custom conditions, and
file replacements:

```
"."                     -> development: real, default: stub (happy path)
"./production"          -> always real
"./stub"                -> always no-op
"./devtools-panel"      -> same development/default split
"./devtools-panel/production"
"./devtools-panel/stub" -> always no-op
```

Angular `fileReplacements` can be used when automatic conditions do not work:

```ts
// src/app/query-devtools.ts
export { withDevtools } from '@benjavicente/angular-query-devtools/production'

// src/app/query-devtools.stub.ts
export { withDevtools } from '@benjavicente/angular-query-devtools/stub'
```

```json
// In the Angular config
"fileReplacements": [
  { "replace": "src/app/query-devtools.ts", "with": "src/app/query-devtools.stub.ts" }
]
```

### With devtools callback runs in injection context

Breaking change.

`withDevtools` accepted a deps array for dependency injection.
The preferred pattern is to run functions in an injection context instead.

```ts
declare class DevtoolsOptionsManager {
  loadDevtools: Signal<boolean>
}

// Old
withDevtools(
  (manager) => ({
    loadDevtools: manager.loadDevtools(),
  }),
  { deps: [DevtoolsOptionsManager] },
)
// New
withDevtools(() => ({
  // boolean | Signal<boolean>
  loadDevtools: inject(DevtoolsOptionsManager).loadDevtools,
}))
```

### Inject queries out of experimental

Breaking change.

`injectQueries` is now exported from the main package

```ts
const getQueries = () => ({ queries })

// Old
import { injectQueries } from '@tanstack/angular-query-experimental/inject-queries-experimental'
const results = runInInjectionContext(injector, () => injectQueries(getQueries))

// New
import { injectQueries } from '@benjavicente/angular-query'
const results = runInInjectionContext(injector, () => injectQueries(getQueries))
```

### SSR hydration by default

Could introduce problems with SSR apps that set up hydration by themselves.

The adapter didn't provide a utility for that for SSR.
Following the same defaults as Angular's [`provideClientHydration`](https://angular.dev/api/platform-browser/provideClientHydration) provides for SSR: default to hydrate with an opt-out (for the adapter, `withNoQueryHydration()`).

```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    // Disable default HTTP cache from the HTTP client from Angular
    // This avoids repeating the same information both in TanStack Query
    // and Angular HTTP hydration
    provideClientHydration(withEventReplay(), withNoHttpTransferCache()),
    provideTanStackQuery(() => new QueryClient(), withDevtools()),
  ],
}
```

`withHydrationKey` can be used for specifying the hydration query key of the client, usefull when there are multiple query clients.

## New features

### Support for `ng add`

Relatively simple to maintain integration for quick installing the package with the Angular CLI.
The only weird thing there is linking the devtools dependency version at build time.

```sh
ng add @benjavicente/angular-query
```

That will:

- Install `@benjavicente/angular-query` and `@benjavicente/angular-query-devtools`
- Add the provider to the application if the application follows Angular conventions

### Resource API via `toResource`

Queries can be converted into Angular's resources with the `toResource` helper the adapter exposes.

This allows an easier integration with Angular's libraries, like Signal Forms.

```ts
myForm = form(model, (path) => {
  validateAsync(path.username, {
    debounce: 300,
    params: ({ value }) => value().trim() || undefined,
    factory: (username) =>
      toResource(
        injectQuery(() => ({
          queryKey: ['username-availability', username()],
          enabled: !!username(),
          queryFn: (): Promise<UsernameValidation> =>
            this.users.checkUsername(username()!),
        })),
      ),
    // Maps success of the resource to form errors, if any
    onSuccess: (result) =>
      result?.available
        ? null
        : {
            kind: 'usernameTaken',
            message: 'Username is already taken',
          },
    onError: () => ({
      kind: 'usernameUnavailable',
      message: 'Could not check username availability',
    }),
  })
})
```

### Persistence is SSR safe

The persistent client was not published. The new one will and is also SSR safe.
The factory runs in an injection context (like `withDevtools`), so it can call
`inject()`; there is no `deps` array.

## Injection context policy

The injection helpers do not accept an `{ injector }` option. They must be
called from an Angular injection context, such as a constructor, field
initializer, provider factory, or an effect created in an injection context.

When a helper genuinely needs to be called later or from another callback,
Angular's `runInInjectionContext` is the explicit escape hatch:

```ts
runInInjectionContext(injector, () => injectQueries(getQueries))
```

The adapter's effects and lifecycle helpers use the current injection context
directly. They do not receive or forward an injector argument.

## Adapter simplification

### Errors are result state

Breaking change. Query, infinite-query, mutation, and parallel-query observer options no longer
expose `throwOnError`. Client defaults with that option do not enable Angular reporting.
Observers publish error transitions through the same synchronous path as successful transitions;
they never throw through core dispatch, emit `NgZone.onError`, or queue an error microtask.
Previously those branches could skip invalidation and leave result and activity signals stale.

`mutateAsync()` still rejects, `mutate()` catches its internal promise, and imperative
`refetch({ throwOnError: true })` retains its core promise behavior. Query data remains readable
after a background error. `toResource` retains Angular Resource's guarded value-read semantics.
Applications can report cache failures once per query or mutation using `QueryCache.onError` and
`MutationCache.onError`; see the [ErrorHandler guide](docs/framework/angular/guides/error-handling.md).

### Fields are signals; methods are explicit

Architectural change. `signalProxy` now maps a declared list of fields to computed signals on an
ordinary object. Query, infinite-query, mutation, and parallel-query methods are defined explicitly.
There is no generic method dispatch through a JavaScript Proxy. Property inspection, enumeration,
and promise assimilation have normal object semantics; unknown fields are not fabricated.
An exhaustive field map detects additions to core result types during compilation.

Methods apply the latest reactive options before invoking an observer, including calls made before
Angular runs its options effect. They run untracked so calling a method does not add option
signals as dependencies of the caller. Field access alone does not evaluate the options factory.

Parallel-query result objects and refetch functions are cached by array position. Both caches are
truncated as results shrink, including refetch functions used by `combine`. A retained method uses
the current query at its index and rejects if that index no longer exists. `combine` runs in an
Angular computed so its own signal dependencies remain reactive.

### Equality does not rewrite snapshots

The adapter no longer calls `replaceEqualDeep` as an Angular equality function, and has no custom
deep comparator. Deep equality is not required for signal correctness and adds traversal work for
arbitrary user selections. Query core continues to own structural sharing of query data.

`injectMutationState` uses shallow array equality: unchanged entries retain the previous array,
but a newly allocated selected object is a change. Changed snapshots are published intact, without
replacing nested references. `injectQueries` combined values use Angular's default `Object.is`.
This can produce additional consumer updates when selectors or combiners allocate equal objects.

### Synchronous notifications and stability

#### Why subscribing inside a computed is unsafe

The problem is the external code that `subscribe()` can run synchronously. A read
can start a fetch, invoke a cache listener, or update other signals before its
surrounding computed has finished. `untracked` prevents dependency tracking; it
neither postpones that code nor makes it safe to reenter an unfinished computed.

These reduced examples illustrate the former subscribe-on-read approach. They omit
subscription bookkeeping and teardown to isolate the first read. Adding a guard to
subscribe only once does not fix either example.

**Example 1: a subscription callback reenters an unfinished computed.**

```ts
import { computed, untracked } from '@angular/core'

const store = {
  getSnapshot: () => 1,
  subscribe() {
    // Represents a synchronous external listener invoked during setup.
    summary()
    return () => {}
  },
}

const value = computed(() => {
  untracked(() => store.subscribe())
  return store.getSnapshot()
})
const summary = computed(() => `Value: ${value()}`)

summary() // Throws: summary is already being evaluated.
```

The call chain is `summary → value → subscribe → summary`. Neither computed has
finished when subscription setup asks for the summary again. Angular detects the
cycle rather than returning a valid value. In Query, the equivalent is an
`observerAdded` cache listener reading a query result while that result's first
read is installing its observer subscription.

**Example 2: subscription setup changes state halfway through a computation.**

```ts
import { computed, signal, untracked } from '@angular/core'

const phase = signal('idle')
let current = 0
const store = {
  getSnapshot: () => current,
  subscribe() {
    current = 1
    phase.set('ready')
    return () => {}
  },
}

const value = computed(() => {
  untracked(() => store.subscribe())
  return store.getSnapshot()
})
const view = computed(() => ({ phase: phase(), value: value() }))

view() // { phase: 'idle', value: 1 }
phase() // 'ready'
```

`view` first captures the old phase. Reading `value` then subscribes, which changes
both the store and the phase. The returned object combines the phase from before
setup with the value from after setup. That pair does not represent either the
initial state (`idle`, `0`) or the completed state (`ready`, `1`). A later
recomputation cannot undo an inconsistent object already returned to a caller.
Even rereading the store after subscribing cannot repair the phase captured by the
outer computation.

The replacement keeps subscription setup outside these computations. An effect
subscribes and then invalidates the snapshot; subsequent reads derive current
state without installing a subscription halfway through their evaluation. This
also catches store changes between an early read and setup. The tradeoff is that
an early cached snapshot can need normal Angular initialization to catch up;
reads are not a synchronous connection API.

This addresses side effects from **subscription setup**, not arbitrary impure
snapshot getters or binding factories. Those still must not write to their inputs
or recursively read the result. It also does not make separate store updates an
atomic transaction.

#### Chosen implementation and testing contract

Architectural change. Subscriptions are inlined into their external-store bindings. Observer
notifications invalidate signals directly, with no adapter batching, queued microtask, or zone
wrapper. The adapter uses `inject-external-store`, which reconciles subscriptions
only in an effect. Reading a result never starts or switches its subscription. The helper retains
tracked snapshot dependencies and unsubscribes from previous sources. Binding factories and initial
snapshots remain lazy so required inputs are not read during construction.

Previously the first read could subscribe before effects ran. An already-read snapshot can now
remain stale until the connection effect runs. After installing the listener, the effect invalidates
the snapshot, closing the gap for changes before or during setup. The next read recomputes the
value; snapshot equality prevents unchanged values from propagating. The same catch-up applies after
source switches and restoration. Snapshots are never eagerly evaluated just to connect.
There is no subscription-error state or custom retry policy: setup and cleanup failures follow
Angular's effect error handling and do not replace readable snapshots. Factory and snapshot
failures remain errors on reads. The effect's cleanup owns unsubscription; destruction does not
force a new detached snapshot.

Public signatures are unchanged. Imperative query and mutation methods still use current options,
but no longer read a result solely to initialize observation. Once connected, cache notifications
remain synchronous. Setup and cleanup can read results; recursive reads during binding factories
or snapshot evaluation remain unsupported.

Tests exercise component initialization, rendered values, cache changes, source replacement,
restoration, and destruction. They should use normal Angular rendering/stability boundaries and
assert the resulting state, without asserting which effect runs first, how many reads setup takes,
or that an intermediate snapshot must be stale. The implementation's scheduling is not a public
API guarantee. `inject-external-store.test.ts` covers the helper contract in both
change-detection modes; the regular query and mutation suites cover adapter behavior. The former subscribe-on-read implementation has been
removed. The design history and standalone version live in `~/Repos/angular-sub`, documented in
`EFFECT-EXTERNAL-STORE.md` there.

#### Why the destruction check remains

An effect can be destroyed while its body is still executing. For example,
`observer.subscribe()` can synchronously emit `observerAdded`; an external listener
can close a dynamically created component using `ComponentRef.destroy()`. Destruction
runs the effect's already-registered cleanup immediately, but does not interrupt the
JavaScript call stack:

```ts
effect((onCleanup) => {
  const unsubscribe = store.subscribe(notify) // External listener destroys the owner here.
  onCleanup(unsubscribe) // Too late for the destruction that already happened.
})
```

Angular's cleanup registration appends to the effect's cleanup list. It does not
immediately execute a callback registered after destruction. Therefore the helper
checks `owner.destroyed` after `subscribe()` returns and releases that subscription
immediately if needed. The earlier check prevents acquiring a replacement subscription
when the previous subscription's cleanup destroys the owner.

Angular itself runs effect cleanup without reactive dependency tracking. Registering
`onCleanup(unsubscribe)` is sufficient; wrapping it in another `untracked` is redundant.
This keeps two direct lifecycle checks without reintroducing an `active` flag or a
connection state machine. A standalone diagnostic on Angular 20.3.18 and 22.1.0
confirmed the behavior for both component and environment-injector destruction:
late registration alone ran cleanup zero times; the explicit check ran it once.

#### QueryClient operations during reactive option changes

Observer options are applied in an Angular effect. Immediately changing a key signal
and calling `QueryClient.invalidateQueries`, `refetchQueries`, or `resetQueries` can
therefore still act on the previous observer before Angular synchronizes. This is an
accepted timing limitation of the current API, not a requirement to make option
application synchronous. The three #6414 expected-failure tests were removed on that
basis. Query result methods such as `query.refetch()` explicitly refresh current
options; arbitrary QueryClient operations do not.

There is upstream precedent for deferring refetches. Vue Query originally delayed the
entire invalidation with `setTimeout(0)` to address reactive key mismatches
([PR #6561](https://github.com/TanStack/query/pull/6561), fixing #6414). That made
invalidation itself unexpectedly asynchronous ([#7694](https://github.com/TanStack/query/issues/7694)).
[PR #7930](https://github.com/TanStack/query/pull/7930) changed it to invalidate immediately
with `refetchType: 'none'`, then refetch after Vue's `nextTick()`. See the
[current Vue implementation](https://github.com/TanStack/query/blob/main/packages/vue-query/src/queryClient.ts).
`nextTick()` is a framework update boundary, not a general guarantee that any timer or
microtask waits for Angular's synchronization.

An Angular equivalent would need a deliberate scheduling contract. Delaying the
refetch could allow a departing observer to unsubscribe before selecting active
queries, but does not guarantee that a newly attached query cannot fetch before a
later explicit refetch. Do not defer all cache operations as an incidental helper
change. `removeQueries` is separate: it removes entries synchronously and does not
itself refetch. An observer that still needs the removed key can recreate it later.
No corresponding deferred-removal policy was found in the reviewed upstream sources.

When query parameters are reactive, derive request parameters from the query function's
`queryKey` (or capture them in the options factory) instead of rereading live signals.
This prevents an old-key request from caching new-key data, even if an extra request
occurs before observer synchronization.

One narrow `NgZone.run` remains in pending-task release. On tested Angular 20, 21, and 22
runtimes with Zone.js, releasing the
last task outside the zone can allow `whenStable()` to resolve between a scheduled render and the
startup of a dependent query. Entering the zone while the task is still held closes that gap.
This is stability bookkeeping, not error reporting or observer-notification scheduling; the zoneless
zone implementation simply invokes the cleanup. The Zone.js dependent-query regression and an
outside-zone DOM update test cover these two responsibilities independently.

Mutation pending work is counted per invocation and released when that invocation's promise settles,
including asynchronous lifecycle callbacks. Completing a newer mutation or calling `reset()` does
not release earlier work. Destruction releases all tasks owned by that injector. Observed queries
with a non-idle fetch status, including paused queries, keep stability open.

### One client provider and opaque features

Breaking change. `provideQueryClient` is removed; `provideTanStackQuery` provides the same setup
without features, including client mount/unmount and default hydration. The second name added no
behavior. Token-based client setup is still supported.

Feature values retain only their opaque public brand and internal providers. The unused feature
kind union, `ɵkind`, and specialized feature aliases are removed. Devtools and persistence share
the provider factory through the internal entrypoint.

### Reactive activity filters

Breaking change. `injectIsFetching` and `injectIsMutating` accept an optional filters factory,
matching the other injection helpers. Signals and required inputs can be read in it. Filter changes
update counts synchronously without requiring a cache event or reinstalling the subscription.
Calls without arguments continue to work.

### One factory form for providers

`provideTanStackQuery` takes `() => QueryClient`; `provideIsRestoring` takes
`() => Signal<boolean>`. Both run through Angular DI. Separate token/value forms
only duplicated that path: use `() => inject(CLIENT_TOKEN)` or `() => state` instead.
The provider tests cover resolving an existing instance and observing signal changes.

Persistence callback return types use `unknown`, which already includes promises;
`Promise<unknown> | unknown` conveyed no additional constraint. Restoration still
awaits returned promises.

### Simplification review: distinctions that still carry behavior

The provider token/value branches were removable because factories express the same
operation with the same DI lifetime. The following distinctions are still useful:

- Query and infinite-query overloads preserve the defined-data result when initial
  data is supplied. Removing them would weaken inference, not just remove runtime code.
- Devtools accepts static values or signals because its options factory runs once in
  an injection context. Turning it into a repeatedly evaluated reactive factory would
  change when `inject()` is valid and how options are updated.
- The local `ResourceSnapshot` type covers Angular 20, which does not export that type.
  It can disappear when the package's minimum Angular version makes it redundant.

### Persistence state belongs to the injector

Restoration state is allocated by a provider factory in each environment injector, rather than
captured when constructing a reusable feature. Reusing a persistence feature in separate clients
no longer shares a restoration signal or lets one restore completion release another client.

### Migration documentation

User-facing migrations are split into [experimental adapter](docs/framework/angular/guides/migrating-from-experimental.md)
and [ngneat/query](docs/framework/angular/guides/migrating-from-ngneat-query.md) guides. The latter
also applies to OpenNG. The original migration URL links to both. Testing, error handling, Resource,
and activity-filter guides describe the supported behavior; implementation rationale stays here.

Regression coverage lives alongside each API in the existing query, infinite-query, mutation,
mutation-state, activity-filter, and declaration test suites. Shared stability cases live in
`pending-tasks.test.ts`, which runs in both change-detection modes. The external-store lifecycle
suite, Zone.js notification integration tests, and persistence feature reuse test cover their own
boundaries.

### Package verification

Declaration imports now receive a file extension even when the filename contains a dot, such as
`inject-queries.types`. Internal test declarations are excluded from the build output. Packed
adapter, devtools, and persistence entrypoints pass `publint` and Are The Types Wrong checks.

Validation on Angular 20.3.18 covers the main runtime/type suite, the Zone.js project, and both
companion packages. Angular 20.1.0 additionally passes a built-package zoneless smoke test and
six Zone.js integration tests, including dependent-query stability and outside-zone rendering.

### Pending-task zone release: version verification

Verified 2026-09-09 against the six tests in
`packages/angular-query/src/__tests__/zoneful-integration.test.ts`.

| Angular runtime         | Zone.js | `ngZone.run(cleanup)` | Direct `cleanup()`                         |
| ----------------------- | ------- | --------------------- | ------------------------------------------ |
| 20.1.0                  | 0.15.1  | 6 passed              | 5 passed, dependent-query stability failed |
| 20.3.18                 | 0.16.0  | 6 passed              | 5 passed, dependent-query stability failed |
| 20.3.30                 | 0.15.1  | 6 passed              | 5 passed, dependent-query stability failed |
| 21.2.22                 | 0.15.1  | 6 passed              | 5 passed, dependent-query stability failed |
| 22.1.5                  | 0.15.1  | 6 passed              | 5 passed, dependent-query stability failed |
| 22.2.0-next.5 (preview) | 0.15.1  | 6 passed              | 5 passed, dependent-query stability failed |

Without the wrapper, `ApplicationRef.whenStable()` resolves while the dependent query's data is
still `undefined`, rather than the expected `'dependent data'`. Restoring the wrapper makes that
regression pass. This is not specific to Angular 20; the wrapper remains required for the tested
Zone.js configurations. Unreleased versions beyond the tested preview are not covered.

Each runtime was resolved from an isolated installation (except the existing 20.3.18 workspace),
including matching Angular core, common, compiler, platform-browser, and their exported subpaths.
The test setup asserted `VERSION.full`. The newer-version comparison used the same Zone.js 0.15.1.
The negative control physically replaced only `ngZone.run(cleanup)` with `cleanup()` in the source
and restored it afterward. A first attempt using a Vite transform was discarded because Angular's
compiler retained the on-disk implementation. The final control used actual source changes.

This is a focused runtime regression matrix using the repository's existing component compiler and
JSDOM test environment, not a full compiler/build compatibility matrix for each Angular major.
The repository dependency versions were not changed.

### Final review corrections

Custom-error inference in `injectQueries` supports both error-tagged query keys and explicitly
annotated `CreateQueryOptions` values. Removing observer `throwOnError` must not make existing
custom-error option objects incompatible with parallel queries. Declaration regressions cover the
field-signal results and the raw results supplied to `combine`.

Testing examples now activate lazy query subscriptions before flushing HTTP requests, enable
component auto-detection when awaiting rendered results, and supply `initialPageParam` for infinite
queries. The migration guide clarifies that manually refetching a disabled query still tracks pending work.

### Test consolidation

Removed the duplicate client-provider and Zone.js destruction test files. The existing provider
suite covers client factories, including factories that resolve existing tokens; the shared pending-task suite covers unresolved query
and mutation destruction in both modes. Removed weaker timed destruction cases in favor of those
unresolved-operation regressions.

The umbrella adapter-contract suites were removed. Their distinct runtime and type regressions now
live next to the corresponding API tests, while repeated filter, cache-callback, and Resource
assertions were merged with existing coverage. The signal-field helper tests cover its own field,
identity, and object-shape behavior; they no longer test manually attached methods.

## Public API consistency follow-up

- Keep query `_defaulted` and `_optimisticResults` types consistent with the other adapters, which also inherit these core query options. Mutation options continue to omit `_defaulted`.
- Persistence now accepts only an options factory. It runs once per injector in the browser injection context; examples and tests use this form.
- Restoration integrations use `provideIsRestoring` from the internal entry point, accepting only a DI factory returning a signal. An existing signal is provided with `provideIsRestoring(() => restoringSignal)`, using the same path as the persister. The restoration token is private and no longer exported by the internal entry point. Persistence retains separate writable state per injector.
- The devtools panel accepts a nullable host for conditional views. Live relocation between existing hosts is not added; changing callbacks can use a stable callback that reads current state.

### Public documentation boundary

`queryFeature`, `getQueryFeatureProviders`, and `provideIsRestoring` are integration
internals exported only through `/internal`, not application setup APIs. They carry
`@internal` annotations so reference generation excludes them. The persister uses the
internal restoration provider; applications use `withPersistQueryClient` and can read
restoration status with the public `injectIsRestoring` helper.

Guides and top-level Angular pages describe application setup and observable behavior.
The public `QueryFeature` type is opaque: its private brand is excluded from generated
documentation. Implementation rationale belongs in this decision record.
