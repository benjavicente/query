# Angular adapter simplification analysis

Reviewed 2026-09-08 against HEAD `f98e70f91` **and the current uncommitted adapter changes**, using Angular 20.3.18 locally. The original audit below is retained as historical evidence. The implementation status and final decisions supersede its proposals.

The recommended direction is: keep Query's observable state and imperative methods; use Angular signals for rendering, `PendingTasks` for application stability, `toResource` for Resource semantics, and cache callbacks for optional application error reporting. The new `injectExternalStore` can remain the subscription foundation.

## Implementation status

All twelve tasks are implemented. Final decisions are recorded in
[Angular Adapter Decisions](../../ANGULAR-DECISIONS.md#adapter-simplification).

The accepted changes differ from the original proposals in these ways:

- T3 maps fields to signals and defines methods explicitly instead of retaining generic Proxy dispatch.
- T4 uses shallow array equality for mutation-state snapshots and default Angular equality for combined
  results. No adapter deep comparison or partial structural sharing is performed.
- T5 removes observer zone wrappers but retains a narrow zone entry when releasing pending work,
  required by the dependent-query stability regression under Angular 20 with Zone.js.
- T9 requires Angular 20.1 and uses native `DestroyRef` directly.
- The external-store helper has one activation policy; its `lazy` option is removed.
- Migration guides are split by source adapter; error reporting is documented through cache callbacks.
- Both parallel-query method and result caches are truncated when the query array shrinks.

The remaining sections describe the pre-change audit and original task proposals, not outstanding work.

## Answers to the six questions

| Question                                       | Recommendation                                                                                                                                   | Reason                                                                                                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does error reporting need `NgZone`?            | Remove adapter-driven zone error reporting. Remove the notification `ngZone.run` wrappers in a separately verified change.                       | Error reporting and change detection are separate responsibilities. A signal notification is sufficient input to Angular's scheduler under supported modern configurations.                                     |
| Can `subscribeToObserver` be inlined?          | Yes, after removing the error machinery.                                                                                                         | It is already a local closure, not a shared external utility. The external-store connection uses descriptor identity, not subscription-function identity.                                                       |
| Is `replaceEqualDeep` correct as equality?     | The existing boolean expression works for whole-result equality, but loses partial structural sharing. Prefer retaining the reconciled snapshot. | `replaceEqualDeep` returns a value, not a boolean; comparing that return value with the previous result discards its reused children when any part changes.                                                     |
| Is the `injectQueries` microtask wrong?        | Remove it together with subscription-time throwing.                                                                                              | In this checkout, ordinary notifications are already synchronous. The remaining microtask is an error-reporting escape from the observer callback, and it captures an error which may be obsolete when it runs. |
| Should Angular expose observer `throwOnError`? | Remove it from Angular hook options. Keep ordinary error state and explicit promise rejection behavior.                                          | There is no adapter-provided component recovery boundary. `toResource` already offers throwing value reads.                                                                                                     |
| Is `provideQueryClient` redundant?             | Remove it.                                                                                                                                       | Its implementation is equivalent to `provideTanStackQuery(factoryOrToken)` with zero features, including mounting and hydration setup.                                                                          |

Angular explicitly distinguishes stateful async APIs such as `resource` from APIs which forward asynchronous failures to `ErrorHandler`. Angular's Resource value can throw when read in an error state. These are separate from an automatic notification on every failed request. Sources: [Angular error handling](https://v20.angular.dev/best-practices/error-handling), [Angular resources](https://v20.angular.dev/guide/signals/resource).

## Evidence from the current implementation

Eight temporary runtime probes confirmed the following observations; the probes were removed after the audit:

| Probe                                                 | Observed result                                                                                                                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Failed mutation with `throwOnError: true`             | The core mutation reached `error`, but a previously read mutation status stayed `pending`. Core `isMutating()` returned 0 while a previously read `injectIsMutating()` stayed 1. |
| Single-query error notification                       | The core query entered `error`, but a previously read `error()` remained `null`; one error microtask was queued.                                                                 |
| Multi-query error notification                        | The same missed invalidation occurred for `injectQueries`.                                                                                                                       |
| Selected mutation state, one of two entries changes   | The other entry remained deeply equal but lost its reference identity.                                                                                                           |
| Multi-query refetch after changing options            | With the same query key and a changed `queryFn` closure, immediate `refetch()` used the old function before the options effect ran.                                              |
| Infinite-query next-page fetch after changing options | Immediate `fetchNextPage()` likewise used the old function.                                                                                                                      |
| Two overlapping calls through one mutation result     | When the second call completed first, `ApplicationRef.whenStable()` resolved while the first mutation remained pending in the cache.                                             |
| Result proxy property inspection                      | Reading `then` fabricated a function; `Object.hasOwn(query, 'notAQueryField')` returned true.                                                                                    |

For the query-error probes, the cache state was set directly and `queueMicrotask` was intercepted to inspect the notification path without producing uncaught process errors. The mutation-error probe used a real rejecting mutation and suppressed only the zone event emission; the adapter's throw still executed. These probes establish the stated failure mechanisms, not an exhaustive browser compatibility matrix.

Existing checks passed before implementation changes:

- The five focused query, multi-query, mutation, mutation-state, and provider files: **122 tests passed**, no reported type errors.
- The configured Zone.js project: **129 tests passed**, no reported type errors. That total includes the runner's selected type tests; it is not 129 separate browser integration cases.
- The eight audit probes passed by asserting the observed problems above.

## Implementation tasks

### T1 — P0: Remove subscription-time error propagation

**Files:** [inject-base-query.ts](/Users/bv/Repos/query/packages/angular-query/src/inject-base-query.ts:84), [inject-queries.ts](/Users/bv/Repos/query/packages/angular-query/src/inject-queries.ts:112), [inject-mutation.ts](/Users/bv/Repos/query/packages/angular-query/src/inject-mutation.ts:79), [types.ts](/Users/bv/Repos/query/packages/angular-query/src/types.ts), [inject-queries.types.ts](/Users/bv/Repos/query/packages/angular-query/src/inject-queries.types.ts).

The error branches return before `onStoreChange`. In mutations, throwing also interrupts core `Mutation.#dispatch` before its mutation-cache notification. This explains why both observer state and cache-derived signals can remain stale. Query microtasks avoid throwing directly through core dispatch but still skip the Angular invalidation. Manually emitting a zone error and separately throwing also creates multiple possible reporting paths, depending on application configuration.

Actions:

- Delete `shouldThrowError`, `ngZone.onError.emit`, subscription throws, and both error microtasks from the Angular adapter.
- Publish every observer state transition, including errors, with the same notification path.
- Omit observer `throwOnError` from `CreateQueryOptions`, `CreateInfiniteQueryOptions`, and `CreateMutationOptions`. Update `injectQueries` inference which currently extracts `TError` from that option. Preserve custom-error inference through supported typed options, explicit generics, and the registered default error; cover these with type tests.
- Document that observer `throwOnError` supplied through shared core `QueryClient` defaults no longer enables Angular error propagation. The core client's cross-framework types need not change.
- Preserve `mutateAsync()` rejection, `mutate()`'s void/caught-promise contract, and **imperative** `refetch({ throwOnError: true })` / QueryClient rejection options. They are different APIs despite sharing the option name.
- Replace tests which intercept `process.uncaughtException` or mock `NgZone.run` to swallow exceptions. The existing `mutateAsync` rejection tests do not establish observer `throwOnError` behavior: it rejects without that flag too.

Acceptance: failed queries/mutations update all relevant signals synchronously with core notification; cache subscribers still receive completion; no automatic global report occurs; default imperative refetch resolves an error result and opt-in refetch rejects; mutation callbacks and pending-task release still complete. Include multiple observers on the same query and a failed background refetch with cached data.

**Migration:** breaking public option removal and error-reporting behavior change. Add before/after examples and link the ErrorHandler recipe below.

### T2 — P1: Track mutation invocations for application stability

**Files:** [inject-mutation.ts](/Users/bv/Repos/query/packages/angular-query/src/inject-mutation.ts:116), [inject-pending-tasks-lifecycle.ts](/Users/bv/Repos/query/packages/angular-query/src/utils/inject-pending-tasks-lifecycle.ts), pending-task tests.

The result of one `MutationObserver` describes its latest mutation. It cannot account for every outstanding call through that observer. Using `state.isPending` for application stability releases the task too soon when the latest call finishes before an earlier one. Resetting the observer can produce the same ownership problem without cancelling the request.

Actions:

- Acquire pending work before starting each `observer.mutate()` invocation; release it when that invocation's promise settles, including awaited lifecycle callbacks.
- Use a local outstanding-call count with the existing lifecycle helper, or one cleanup per invocation. Prefer the count if it keeps destruction handling simple.
- Return the promise with its settlement cleanup attached, and ensure `mutate()` catches that returned promise. Do not create an ignored rejecting `.finally()` promise.
- Remove mutation pending-task toggles from the observer subscription. It should only invalidate state; completion of one observer result must not release another call's work.
- Continue releasing this owner's pending work on destruction, even if the underlying mutation continues.

Acceptance: constructor and `ngOnInit` mutations block stability immediately; two calls completing in either order remain pending until both finish; reset does not release outstanding work; rejection and destruction release correctly. Retain the existing paused-mutation policy unless deliberately changing it.

**Documentation:** architectural ownership change and corrected `whenStable()` behavior. State that this tracks invocations through the adapter, not every unobserved operation on a `QueryClient`.

### T3 — P1: Apply current options before every imperative query method

**Files:** [inject-base-query.ts](/Users/bv/Repos/query/packages/angular-query/src/inject-base-query.ts:126), [inject-infinite-query.ts](/Users/bv/Repos/query/packages/angular-query/src/inject-infinite-query.ts), [inject-queries.ts](/Users/bv/Repos/query/packages/angular-query/src/inject-queries.ts:163).

Single-query `refetch` and mutation methods already synchronize their options before executing. Infinite page methods and multi-query `refetch` currently expose core methods without the same synchronization. An optimistic snapshot does not establish that the observer's execution options are current.

Actions:

- Give `fetchNextPage`, `fetchPreviousPage`, and multi-query `refetch` the same explicit method-time synchronization contract.
- Apply options under `untracked` outside snapshot computations. Preserve the separate options effect: putting `setOptions` or `setQueries` inside `getSnapshot` would reintroduce synchronous cache-listener reentrancy problems.
- Include methods passed to `combine`, not just the methods on the uncombined proxies.
- Define which query an extracted multi-query method addresses after reordering. If index identity is retained, resolve the current slot at invocation and handle a removed slot deliberately.

Acceptance: update a signal used by `queryFn`, page parameters, or query key and immediately invoke the method without ticking effects; it uses the new options. Test both page directions, extracted methods, combined results, reordering, and restoration. Preserve existing required-input and reentrancy tests.

**Documentation:** corrected same-turn method behavior, plus any chosen extracted-method identity contract.

### T4 — P1: Retain structural sharing in mutation-state snapshots

**Files:** [inject-mutation-state.ts](/Users/bv/Repos/query/packages/angular-query/src/inject-mutation-state.ts:66), [replaceEqualDeep](/Users/bv/Repos/query/packages/query-core/src/utils.ts:291).

The current comparator is a valid boolean equality function for the plain structures supported by `replaceEqualDeep`. It does not silently accept all updates. However, when one entry changes, `replaceEqualDeep` constructs a partially shared result and the comparator discards it. Angular accepts the original, unshared `next` array instead. This matters especially when `select` creates new objects; unchanged core mutation-state references may already be stable.

Recommended action: keep a local previous-result cache in `getSnapshot`, assign `previous = replaceEqualDeep(previous, getResult(...))`, return it, and let the external-store signal use its default `Object.is` equality. Keep this domain-specific reconciliation out of the generic subscription helper. This uses the same retained-result pattern already used correctly for `injectQueries`'s `combine` output.

Acceptance: wholly equivalent snapshots retain the array; changing one selected entry preserves equal siblings and nested references; reactive filter/select dependencies still update; removed entries disappear; non-plain values follow core structural-sharing semantics. Treat immutable data as the contract; this is not a general equality algorithm for arbitrary mutable/cyclic objects.

**Decision to revisit:** `ADAPTER-DESIGN-FOLLOWUPS.md` explicitly chose whole-result equality and discarded partial sharing. That is an intentional tradeoff, not an accidental boolean-type bug. Keeping it is defensible, but must be described as reduced sharing. My recommendation is to retain sharing because the current code already pays for the reconciliation traversal.

**Documentation:** result identity contract and its effect on selected mutation entries.

### T5 — P1: Remove notification `NgZone.run` wrappers

**Depends on T1. Files:** the three observer adapters.

Call `onStoreChange()` directly. Angular's supported notification model includes updating a signal consumed by a template. `NgZone.run` is not itself an error boundary: its documented synchronous-error behavior is to rethrow; `runGuarded` is the distinct error-forwarding API. Sources: [Angular zoneless compatibility](https://v20.angular.dev/guide/zoneless), [NgZone API](https://v20.angular.dev/api/core/NgZone).

Keep the query pending-task ordering: acquire pending work before invalidation and notify before releasing completed work. The release is still needed when the application uses Zone.js. Do not replace explicit pending tasks with the presence of an Angular zone.

Acceptance: actual OnPush DOM updates from a notification originating outside Angular's zone, without manual `detectChanges`; dependent queries render before `whenStable` resolves; invalidation, restoration, errors, and destruction work in both scheduler modes. Run this on the declared Angular minimum and a current supported version. The audit's passing baseline tests do not establish that this removal has already been validated.

**Documentation:** zone-independent notification architecture; applications must use a compatible Angular scheduler configuration. Clarify that Query callbacks do not acquire an injection context or guaranteed zone membership.

### T6 — P2: Inline the now-small subscriptions

**Depends on T1/T5. Files:** `inject-base-query.ts`, `inject-queries.ts`.

Move each local `subscribeToObserver` body into the external-store descriptor's `subscribe` property, closing over the observer already obtained there. This removes an unnecessary lookup and indirection. No extra abstraction is required merely to share a few notification/cleanup lines.

Preserve the binding dependency boundary: read observer identity and restoration eligibility in the descriptor factory; read reactive query options in `getSnapshot` and the options effect. Reading all options in the descriptor factory would create a new descriptor and unnecessarily unsubscribe/resubscribe on every options change. The stability of the old named callback is not what prevents this.

Acceptance: option-only changes do not resubscribe or refetch unchanged stale queries; restoration pauses/resumes once; required inputs remain lazy; cleanup and query stability tests pass.

**Documentation:** internal refactor only, unless lifecycle semantics change. Keep the generic store's `equal: () => false` on its connection computation: that concerns propagation/reconciliation, not snapshot structural sharing.

### T7 — P2: Remove `provideQueryClient`

**Files:** [providers.ts](/Users/bv/Repos/query/packages/angular-query/src/providers.ts:70), root exports, provider tests, generated API pages and docs navigation.

Replace all application/test uses with `provideTanStackQuery(factoryOrToken)` and delete the duplicate public function. Both currently execute `configureQueryClient`, so the removed API is not a genuinely bare DI registration. A plain `{ provide: QueryClient, useFactory: ... }` is appropriate only when the caller explicitly owns setup; it is not the equivalent migration because it omits mounting and hydration.

Acceptance: factory and token forms still run once per injector; child injector setup/unmount and SSR hydration retain their behavior; generated declarations, docs, and examples no longer advertise the removed name.

**Migration:** `provideQueryClient(factoryOrToken)` → `provideTanStackQuery(factoryOrToken)`.

### T8 — P1: Allocate persistence restoration state per injector

**Related package; source finding, not runtime-probed in this audit. File:** [with-persist-query-client.ts](/Users/bv/Repos/query/packages/angular-query-persist-client/src/with-persist-query-client.ts:101).

`withPersistQueryClient` currently allocates `signal(true)` when the feature is constructed and installs that instance with `useValue`. Reusing one provider configuration in two application/environment injectors therefore shares restoration state even if their QueryClients are created independently. Completion in one injector can enable queries in the other prematurely.

Move the writable restoration signal into an injector-scoped provider factory. Let both the public readonly restoration token and the initializer resolve that instance. Reusing the feature description must not reuse its mutable state.

Acceptance: reuse exactly one feature/provider value in two environment injectors with separate delayed restores; completing A leaves B restoring; destroying A leaves B intact. Cover server initialization and browser restoration independently.

**Documentation:** injector ownership architecture and provider-reuse fix. This directly supports the existing SSR-safe client-factory decision.

### T9 — P2: Align the Angular floor before deleting compatibility code

**Files:** [destroy-ref-compat.ts](/Users/bv/Repos/query/packages/angular-query/src/utils/destroy-ref-compat.ts), internal exports, all three Angular packages and their lifecycle tests.

`DestroyRef.destroyed` is absent in the [Angular 20.0 source](https://raw.githubusercontent.com/angular/angular/20.0.0/packages/core/src/linker/destroy_ref.ts) and present in [20.1](https://raw.githubusercontent.com/angular/angular/20.1.0/packages/core/src/linker/destroy_ref.ts). The peer dependency currently promises `>=20.0.0`; checking current v20 documentation alone hides this distinction.

Recommended simplification, if acceptable for this breaking release: require at least Angular 20.1, then inject native `DestroyRef` directly throughout core, persistence, and devtools. Remove the compatibility token, wrapper, fallback callback, and override-only tests. Otherwise retain a small 20.0 fallback and test it against real 20.0 APIs. Do not delete it merely because the release says “Angular 20”.

**Migration:** exact minimum-version change if chosen; verify corresponding core/common peer ranges and test tooling. Retain other genuinely necessary compatibility, including the local `ResourceSnapshot` type for Angular 20.

### T10 — P2: Make fetching/mutating filters consistently reactive

**Files:** [inject-is-fetching.ts](/Users/bv/Repos/query/packages/angular-query/src/inject-is-fetching.ts), [inject-is-mutating.ts](/Users/bv/Repos/query/packages/angular-query/src/inject-is-mutating.ts).

These accept a static filters object while `injectMutationState` and the query adapters accept factories. A predicate can currently read a signal indirectly through the snapshot, but changing a query/mutation key has no equally direct factory API.

Use an optional `() => QueryFilters` / `() => MutationFilters` factory, evaluated in `getSnapshot`. Keep the cache subscription descriptor independent of its reactive values. Given the breaking-release scope, prefer one consistent factory form over retaining an object-or-function overload indefinitely.

Acceptance: required-input keys work; a key/filter change updates the count immediately without a cache event; no resubscription occurs; predicate signal reads remain tracked.

**Migration:** `injectIsFetching({ queryKey })` → `injectIsFetching(() => ({ queryKey }))`, and the mutation equivalent.

### T11 — P2: Make result objects obey ordinary property semantics

**File:** [signal-proxy.ts](/Users/bv/Repos/query/packages/angular-query/src/utils/signal-proxy.ts:35).

The generic proxy fabricates a computed function for unknown fields and returns descriptors for nonexistent properties. In particular, a fabricated callable `then` makes the object look like a thenable; promise assimilation can invoke it without ever settling through the supplied callbacks. The fabricated property and incorrect `hasOwn` results were reproduced; promise assimilation itself was not awaited in the probe.

Evaluate replacing the fully generic traps with a known result-field schema and explicit methods. Computed field values can remain lazy even when the public field names are known in advance. This can simplify reflection, preserve alias-before-input behavior, and integrate the method wrappers from T3. If retaining the proxy is smaller, fix unknown keys, protocol symbols, inherited properties, and descriptors explicitly.

Acceptance: unknown `then` is undefined; nonexistent fields fail `Object.hasOwn`; enumeration/spread reflect actual fields; extracting field signals and methods does not initialize required inputs; field/method identities remain stable. Cover single, infinite, mutation, and multi-query results.

**Documentation:** result-object architecture if changed. Keep the familiar field-signal API unless there is a separate reason to migrate every consumer to a single result signal.

### T12 — P3: Delete dead metadata and refresh design notes

- `QueryFeatureKind` and `ɵkind` are produced but not consulted anywhere in the reviewed Angular packages. Remove the discriminator and closed kind union from the internal feature factory, while retaining the already-decided opaque `QueryFeature` and internal package boundary. No new extensibility system is needed.
- The internal external-store `lazy` option has no current adapter call sites. Remove it if this utility is intentionally adapter-specific; retain it only if its alternate activation contract is a deliberate requirement. Correct the examples which still use the old `injectExternalStoreOnRead` name.
- `ADAPTER-DESIGN-FOLLOWUPS.md` describes removed `injectLinkedStoreSignal` / `injectObserverSignal` helpers and lists proxy caching as proposed although it is implemented. Replace stale status text or archive the historical explanation.
- `ANGULAR-DECISIONS.md` still explains provider initialization through `provideAppInitializer`, while the source now uses `provideEnvironmentInitializer`. Correct that rationale, particularly because route environment injectors are supported.
- Refresh the old microtask/lifecycle claims in `ISSUES.md` and the completed injection-context item in `TODO.md`. Source changes should not leave the audit inventory asserting an obsolete mechanism.

**Documentation:** these are primarily maintenance changes; avoid presenting every deletion as a user-facing breaking change.

## ErrorHandler guide to ship with T1

Add an Angular error-handling guide, linked from mutations, query errors, Resource integration, and the experimental-package migration. A factory is already supported, so a new `withErrorHandler` feature is unnecessary.

```ts
import { ErrorHandler, inject } from '@angular/core'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  provideTanStackQuery,
} from '@tanstack/angular-query'

export const queryProviders = provideTanStackQuery(() => {
  const errors = inject(ErrorHandler)

  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.reportToErrorHandler !== false) {
          errors.handleError(error)
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (mutation.meta?.reportToErrorHandler !== false) {
          errors.handleError(error)
        }
      },
    }),
  })
})
```

This is an opt-in application reporting policy. Capture `ErrorHandler` in the provider factory; do not call `inject()` later inside a cache callback. The app-specific `meta` flag allows locally handled failures to opt out. If the application already constructs caches or defines callbacks, compose that policy into those callbacks instead of silently replacing them.

Explain three distinct operations:

- **Render/recover:** read `query.error()`, `query.status()`, and cached `query.data()`; use mutation `onError` for local handling or catch `mutateAsync`.
- **Read a Resource:** `toResource(query).value()` already throws in its mapped error state. `status`, `error`, `snapshot`, and `hasValue` remain inspectable. An uncaught value read during Angular rendering can still reach Angular's error handling; removing automatic adapter reporting does not make such a read harmless.
- **Report:** cache callbacks report failed cache operations independently of how many components observe them. They do not report observer-only `select` failures or exceptions in Angular option/combine computations. Do not describe this recipe as catching every adapter error, or as providing component recovery boundaries.

Keep ordinary `query.data()` nonthrowing. Cached data may still be useful after a failed background refetch. Throwing from the shared result signal would also prevent reading its error/status fields, and making `data()` throw would require revisiting consumers such as `toResource.status()` which read it while determining status.

The existing Resource guide should explicitly document throwing reads, background-refetch errors with cached data, and the intentionally stale-only `reload()` contract. That behavior already exists and needs clearer explanation rather than another wrapper API.

## Delivery order and documentation requirements

Implement T1 with its guide first; then T2 and T3 with their reproductions converted into regression tests. T4 and T8 are independent correctness/identity work. Follow with T5/T6, the provider removal, and the optional API/infrastructure simplifications.

For each accepted user-facing or architectural change, update `ANGULAR-DECISIONS.md` in the same change with: previous behavior, new contract, rationale, a migration example when relevant, and links to regression coverage. Keep proposals in this plan until accepted.

Create a distinct migration section or guide for users of `@tanstack/angular-query-experimental`; the current `migrating-to-angular-query.md` primarily covers OpenNG migration. Regenerate the API reference and remove obsolete pages/navigation rather than only changing hand-written examples. The existing reference tree still contains removed feature aliases.

Preserve the work already achieved: required-input-safe initialization, first-read subscriptions, synchronous cache invalidation, reactive `combine` computation in Angular, raw observer notifications for pending-task tracking, and cleanup on destruction. In particular, routing `combine` back through core equality gating could hide raw fetch transitions needed for stability or changes to the Angular signals it reads.

Treat offline/paused work as an explicit policy: current tests intentionally block stability while queries are paused. Changing that could help some offline UIs but would be a separate behavioral decision, not a safe incidental cleanup of the pending predicate.
