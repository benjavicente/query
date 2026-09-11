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
import { withDevtools } from '@tanstack/angular-query-devtools'
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
export { withDevtools } from '@tanstack/angular-query-devtools/production'

// src/app/query-devtools.stub.ts
export { withDevtools } from '@tanstack/angular-query-devtools/stub'
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
import { injectQueries } from '@tanstack/angular-query'
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
ng add @tanstack/angular-query
```

That will:

- Install `@tanstack/angular-query` and `@tanstack/angular-query-devtools`
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

Architectural change. Subscriptions are inlined into their external-store bindings. Observer
notifications invalidate signals directly, with no adapter batching, queued microtask, or zone
wrapper. The external-store helper reconciles subscriptions on an effect or first read, uses
tracked snapshot dependencies, and ignores retired connections. Its optional `lazy` mode is removed;
there is one activation policy and snapshots remain lazily evaluated.

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
suite covers factory and token injection; the shared pending-task suite covers unresolved query
and mutation destruction in both modes. Removed weaker timed destruction cases in favor of those
unresolved-operation regressions.

The umbrella adapter-contract suites were removed. Their distinct runtime and type regressions now
live next to the corresponding API tests, while repeated filter, cache-callback, and Resource
assertions were merged with existing coverage. The signal-field helper tests cover its own field,
identity, and object-shape behavior; they no longer test manually attached methods.

## Public API consistency follow-up

- Keep query `_defaulted` and `_optimisticResults` types consistent with the other adapters, which also inherit these core query options. Mutation options continue to omit `_defaulted`.
- Persistence now accepts only an options factory. It runs once per injector in the browser injection context; examples and tests use this form.
- Restoration integrations use `provideIsRestoring`, accepting a signal or a DI factory returning a signal. The restoration token is private and no longer exported by the internal entry point. Persistence retains separate writable state per injector.
- The devtools panel accepts a nullable host for conditional views. Live relocation between existing hosts is not added; changing callbacks can use a stable callback that reads current state.
