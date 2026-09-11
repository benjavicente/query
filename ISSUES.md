# Angular adapter issue inventory

> **2026-09-10 verification:** The current evidence is in
> [ANGULAR-ISSUE-VERIFICATION.md](ANGULAR-ISSUE-VERIFICATION.md). The inventory
> below contains historical observations and superseded API decisions. Current
> browser checks pass for #9020/#9735, #11176 has overlap/reset coverage, #10861
> is closed upstream, and `provideQueryClient` is now removed. The new audit
> reproduces the Angular case in #6414 and a shared-devtools declaration leak
> related to #6153; do not use the older “verified” labels as release sign-off.

Updated 2026-08-19 for the current `angular-release/scoped-publishing` worktree.

This is an inventory of Angular-adapter issues in `TanStack/query`, grouped by
behavior. “Open” means the GitHub issue is open. “Verified fixed” means the
current worktree has a matching implementation and/or regression test. A
closed GitHub issue is not automatically marked verified: some were closed as
design decisions, documentation work, or external test-runner issues.

## Current local findings

Two local examples reproduce the timing behavior:

- `examples/angular/optimistic-update-timing/`: after `onMutate`, the cache is
  already `new` while the Angular result signal is still `old title`; the
  signal catches up in a microtask.
- `examples/angular/mutation-lifecycle-timing/`: mutations started in the
  constructor and `ngOnInit` report `success/pending=false` immediately while
  the two-second mutation is still running. `ngAfterContentInit` does not show
  the same initial-state gap.

The current implementation explains the remaining observations, and the
latest direct-subscription change also separates the batching issue from the
other timing issues:

- Angular observer subscriptions now update result signals directly, without
  an adapter-level `notifyManager.batch()` or `batchCalls()` wrapper. The core
  scheduler is still untouched.
- The current `injectMutation` path eagerly initializes the lazy observer when
  `mutate()` is first called. With direct subscriptions, the exact constructor,
  `ngOnInit`, and `ngAfterContentInit` lifecycle reproduction now reports
  `pending=true` in all three phases. The earlier idle observations came from
  the pre-change implementation and from a test that read the component before
  running Angular lifecycle initialization.
- `packages/angular-query/src/inject-base-query.ts` no longer delays ordinary
  result updates with `queueMicrotask()`. The cache update and observer
  notification scheduler can still introduce a boundary for optimistic data;
  that behavior remains covered by #9735.

The first issue is also independently reported as [#11176](https://github.com/TanStack/query/issues/11176),
and the constructor/`ngOnInit` case as [#9020](https://github.com/TanStack/query/issues/9020).
The optimistic rendering gap is [#9735](https://github.com/TanStack/query/issues/9735).

### Exact reproduction steps

For #9020/#11176:

```sh
pnpm --dir examples/angular/mutation-lifecycle-timing start
```

On the page, wait for the automatic two-second mutations and inspect both
sections. The immediate observations for constructor and `ngOnInit` can show
`status=idle, pending=false` even though the request is running. Then click
**Start mutation and await whenStable**. A broken result changes from
`waiting` to a success message immediately, before the two-second mutation has
settled. A fixed result remains `waiting` until it reports `success`.

For #9735:

```sh
pnpm --dir examples/angular/optimistic-update-timing start
```

Click **Save**. The broken timing is visible in the snapshots when the first
two entries are equivalent to:

```text
onMutate / same turn — cache=new title, signal=old title
after mutate + edit false — cache=new title, signal=old title
```

The signal catches up at the microtask/next rendering boundary. The desired
behavior is for cache and signal to both be `new title` in the same turn, so
switching from the editor to the display does not reveal the old title.

## 1. Open correctness issues

| Issue | Status in this worktree | Evidence | Hint for a fix or next test |
| --- | --- | --- | --- |
| [#11176](https://github.com/TanStack/query/issues/11176) — `whenStable()` resolves while `mutate()` is still running | **Open; locally fixed by removing the Angular wrapper; regression added** | The exact reproduction now passes after replacing Angular’s `notifyManager.batchCalls()` subscription with a direct subscription. Core notification scheduling remains in place, but the extra Angular scheduling turn was the observed `whenStable()` gap. | The regression is now in `pending-tasks.test.ts`. Add a second-mutation/overlap assertion before closing the GitHub issue. |
| [#9020](https://github.com/TanStack/query/issues/9020) — pending state missed from constructor/`ngOnInit` | **Open upstream; not reproduced after current changes** | An exact lifecycle test with `fixture.detectChanges()` now reports `pending=true` for constructor, `ngOnInit`, and `ngAfterContentInit`. The old idle observations were from the pre-change implementation or from reading before lifecycle initialization. | Keep the lifecycle example as a regression. If it still fails in a real browser, capture the exact package commit and Angular/zone configuration before changing the implementation again. |
| [#9735](https://github.com/TanStack/query/issues/9735) — optimistic updates are not synchronous | **Open; reproduced in the app example** | `onMutate / same turn` and `after mutate + edit false` show `cache=new, signal=old title`; the signal becomes new at the microtask boundary. | Decide whether Angular should expose cache-driven optimistic results in the same turn. If yes, remove or narrow the query-side `queueMicrotask()` deferral, or synchronously update the result signal for observer notifications while retaining batching for change detection. Add a test that records cache and signal values in the same turn, microtask, and animation frame. |
| [#9981](https://github.com/TanStack/query/issues/9981) — `isSuccess` does not trigger an effect in tests | **Open; not reproduced by the focused local test** | A focused test covering `effect(() => query.isSuccess())` passed on this branch. The issue may depend on the exact Angular/Vitest version or test setup. | Keep a regression using the issue’s original setup. Verify both zoneless and zone-based TestBed, and assert the effect after `fixture.whenStable()` rather than relying on an incidental flush. |
| [#10046](https://github.com/TanStack/query/issues/10046) — Angular unit tests behave unexpectedly | **Open; not reproduced by the focused local test** | Local tests covering query result reads and class-field aliases passed. | Re-run the original reproduction against the release package and current Angular version. If fixed, add a minimal permanent test and close or update the issue with the version that fixed it. |
| [#9910](https://github.com/TanStack/query/issues/9910) — reading query signals in a template can fail tests | **Open; not reproduced locally** | The current adapter’s signal proxy and focused template test do not reproduce the failure. | Preserve a template-level regression, because a class-only test is insufficient. Test the first render, pending-to-success transition, and a signal read from an aliased result. |
| [#8704](https://github.com/TanStack/query/issues/8704) — fix `injectQueries` | **Open; implementation appears present** | `injectQueries` is exported from the main package and has focused tests, including injector use and pending-task behavior. | Treat this as a tracker/verification item. Confirm the public docs, stable package exports, lazy initialization, cleanup, and pending-task semantics before closing it. |
| [#8984](https://github.com/TanStack/query/issues/8984) — no type narrowing for infinite-query status | **Open; likely fixed in this branch** | `inject-infinite-query.test-d.ts` contains `isSuccess`, `isError`, and related narrowing cases. | Run the type-test suite and add the exact original `isSuccess()` example if it is not already equivalent. Then update the issue rather than carrying it as an unresolved release blocker. |
| [#7488](https://github.com/TanStack/query/issues/7488) — accessing `.data` evaluates options too early | **Open; likely fixed by lazy observer initialization** | `injectBaseQuery` creates the observer in a dependency-free `computed`, and the decisions document explicitly requires aliases such as `injectQuery(...).data` not to initialize early. | Keep an exact required-input regression: save `.data`, leave the input unset, then set the input and read the signal. Ensure the options function is not evaluated before the first signal read. |

## 2. Release, package, and API decisions

| Issue | Status in this worktree | Evidence | Hint for a fix or next test |
| --- | --- | --- | --- |
| [#8703](https://github.com/TanStack/query/issues/8703) — stable release tracking | **Open; release work remains** | `ANGULAR-DECISIONS.md` records the intended stable package changes, but package publishing/versioning is part of the current branch work. | Track this separately from runtime correctness. Verify package names, peer ranges, exports, generated declarations, `ng add`, devtools package version alignment, and a clean install from the packed artifacts. |
| [#8713](https://github.com/TanStack/query/issues/8713) — publish stable package / deprecate experimental package | **Open; release work remains** | The source has the stable-style API, but publishing and deprecation are repository/release actions rather than source-only fixes. | Before closing, test the published package in a fresh Angular application and document the migration from experimental imports. |
| [#10861](https://github.com/TanStack/query/issues/10861) — deprecate the experimental devtools package | **Open; release work remains** | Devtools now has a separate package and stable subpaths in this branch. | Verify the final package name, peer dependency, exports, production/stub conditions, and that the old experimental devtools entry point is either intentionally retained or intentionally removed. |
| [#8711](https://github.com/TanStack/query/issues/8711) — injector parameter consistency | **Closed; API decision is implemented** | Injection helpers now require the current Angular injection context and no longer accept `{ injector }`. `injectMutation()` works without a manually supplied injector when called from a field initializer, constructor, factory, or equivalent context. | Use Angular's `runInInjectionContext` at the application call site when a helper genuinely must be invoked later. Do not add an injector option back to the adapter helpers. |
| [#8714](https://github.com/TanStack/query/issues/8714) — what must run in the injection context | **Closed; decision documented** | `ANGULAR-DECISIONS.md` records the injection-context policy and the implementation uses Angular effects/injectors for lifecycle-bound work. | Review every callback that calls `inject()` (`provideTanStackQuery`, `withDevtools`, persistence, and query option factories). This is a design audit, not a reason to pass an injector manually to ordinary `injectMutation()` calls. |
| [#8707](https://github.com/TanStack/query/issues/8707) — Angular framework support policy | **Closed; decision documented** | The decisions document sets Angular 20 as the supported floor. | Verify `peerDependencies`, CI matrix, and README wording agree with the decision. Avoid claiming support for pre-release Angular versions unless CI covers them. |
| [#8712](https://github.com/TanStack/query/issues/8712) — remove deprecated APIs | **Closed; mostly implemented** | `provideAngularQuery` and `injectQueryClient` are absent from the current main source exports; `provideQueryClient` remains as a lower-level provider. | Check the migration guide and generated API docs. Do not remove `provideQueryClient` solely because `provideTanStackQuery` exists: it is intentionally the minimal provider for child injectors/tests. |

### `provideQueryClient` versus `provideTanStackQuery`

These are not equivalent names for the same public role:

- `provideTanStackQuery()` is the normal application provider and accepts
  optional features such as hydration, persistence, and devtools.
- `provideQueryClient()` is the minimal provider for overriding a client in a
  child injector or test.

That distinction is consistent with the current source and is worth keeping
in the migration notes. The name `provideTanStackQuery` is the better default
application-facing name; removing `provideQueryClient` would remove a useful
low-level/testing API rather than merely deleting an alias.

## 3. Closed Angular issues that should be treated as verified or historical

These issues are closed in GitHub and appear covered by the current design or
tests. They are not active blockers, but the release checklist should retain
the relevant regression tests.

### Providers, lifecycle, and hydration

- [#8705](https://github.com/TanStack/query/issues/8705) — support a provider on
  lazy-loaded routes. The `EnvironmentProviders` design and router-provider
  documentation address this. Verify with a route-level injector and a client
  that is not accidentally shared with the root.
- [#8824](https://github.com/TanStack/query/issues/8824) — `withDevtools` loses
  dependency injection. The callback now runs in an injection context and the
  devtools tests cover injected options.
- [#9174](https://github.com/TanStack/query/issues/9174) — refetch immediately
  after a signal update. Closed, but still relevant to the general scheduling
  contract; keep a reactive-options regression when changing query scheduling.
- [#8839](https://github.com/TanStack/query/issues/8839) — caught query errors
  do not run in the Angular zone. Observer errors are now result state; optional
  `ErrorHandler` reporting uses cache callbacks. There is no zone error emission.
- [#8545](https://github.com/TanStack/query/issues/8545) — disabled-query and
  refetch fields were abnormal. Treat as covered by current query-result tests,
  but check `enabled: false`, manual refetch, and signal transitions.
- [#8811](https://github.com/TanStack/query/issues/8811) — query stuck after
  `setQueryData` with an unset value. Historical/closed; retain a cache-update
  regression if changing the result proxy or optimistic scheduling.

### Devtools, packaging, and documentation

- [#9078](https://github.com/TanStack/query/issues/9078) — esbuild generated
  devtools chunks unconditionally. The separate devtools package and explicit
  production/stub subpaths address the intended packaging boundary.
- [#8018](https://github.com/TanStack/query/issues/8018) — devtools included in
  production builds. Same package-boundary fix; verify a production build does
  not contain the real devtools implementation unless the production subpath
  is explicitly used.
- [#6153](https://github.com/TanStack/query/issues/6153) — devtools leaked Solid
  types. Treat as solved by the separate Angular devtools package and generated
  declarations, but inspect the packed `.d.ts` output.
- [#8706](https://github.com/TanStack/query/issues/8706) — update stable-release
  docs. The current decisions and API docs cover the new provider names, but a
  migration page should be checked before release.
- [#9744](https://github.com/TanStack/query/issues/9744) — Angular docs used the
  React `useIsFetching` example. Closed documentation issue; run a docs search
  for React/Vue hook names in Angular pages before publishing.
- [#9536](https://github.com/TanStack/query/issues/9536) — missing Angular
  community-projects page. Closed documentation issue; no runtime action.
- [#9525](https://github.com/TanStack/query/issues/9525) — persister example
  referenced an unpublished package. The current decisions call for a
  publishable SSR-safe persistence package; validate the final package name in
  the example.

### Types and test integrations

- [#7401](https://github.com/TanStack/query/issues/7401) — `isPending` was not
  typed as a signal. Current Angular result types expose signal functions.
- [#6635](https://github.com/TanStack/query/issues/6635) — query/mutation type
  narrowing. Current query and mutation declaration tests cover status-based
  narrowing; #8984 remains the infinite-query-specific follow-up.
- [#8042](https://github.com/TanStack/query/issues/8042) — mutation `onSuccess`
  lost its type when a query client was supplied. Current mutation option type
  tests cover typed callbacks.
- [#8318](https://github.com/TanStack/query/issues/8318) —
  `CreateMutationOptions` was not exported. It is exported from the current
  package entry point.
- [#8475](https://github.com/TanStack/query/issues/8475) — `QueryClient` was
  not exported. It is re-exported from the current Angular entry point through
  query-core.
- [#8115](https://github.com/TanStack/query/issues/8115) — Cypress component
  tests failed with Angular Query. Closed and test-runner-specific; add a smoke
  test only if Cypress support is part of the release promise.
- [#7080](https://github.com/TanStack/query/issues/7080) —
  `HttpTestingController` mutation tests. Closed integration issue; keep an
  Angular HTTP testing example if the docs promise this workflow.
- [#7023](https://github.com/TanStack/query/issues/7023) — UI did not re-render
  on signal changes. Current signal-proxy/result tests cover the normal signal
  path, but #9735 shows that “eventually re-renders” is not the same as
  “updates in the same turn.”
- [#6522](https://github.com/TanStack/query/issues/6522) — Angular home page
  demo was blank. Historical site/demo issue, not an adapter blocker.
- [#8364](https://github.com/TanStack/query/issues/8364) — Jest could not find
  the experimental module. Historical packaging issue; re-check only if the
  experimental compatibility package is retained.

## 4. Cross-adapter comparison and implementation hints

The other adapters do not have Angular’s `PendingTasks` contract, so they do
not provide a direct answer for `whenStable()`. They do show where Angular is
adding extra scheduling:

- React and Preact subscribe to `MutationObserver` with
  `notifyManager.batchCalls()`, but their correctness contract is a React
  render commit, not Angular application stability. Angular needs a separate
  synchronous pending-task edge because `mutate()` is fire-and-forget.
- Vue subscribes directly and updates reactive state in the observer callback;
  Vue has no equivalent of `ApplicationRef.whenStable()` that the adapter must
  hold open for a mutation.
- Svelte batches the state assignment, but likewise has no Angular pending-task
  registry. Its state update is the useful comparison for result propagation,
  not for SSR stability.
- Solid’s query adapter explicitly uses microtask scheduling around observer
  work. That supports batching as a reasonable cross-framework technique, but
  it does not establish that Angular’s signal must lag the cache through an
  animation frame. Angular should make the optimistic-update timing an
  explicit contract and test it directly.

The practical fix direction is therefore:

1. Keep the core scheduler untouched, but do not add an Angular-level
   `batchCalls()`/`batch()` wrapper around observer subscriptions.
2. Update the public mutation result or lifecycle state synchronously at the
   `mutate()` boundary so constructor/`ngOnInit` calls immediately show pending.
3. Release mutation pending work when each invocation settles, or when its owner is destroyed.
   Reset and a newer invocation must not release an older invocation.
4. Query result notifications are synchronous; same-turn cache and options regressions
   cover this contract. No adapter microtask remains.
5. Use the original issue reproductions as permanent tests, rather than relying
   on `setTimeout()` or a browser frame to make the adapter appear settled.

## 5. Items deliberately excluded

The repository search also finds many non-Angular issues whose bodies mention
Angular incidentally: React/Vue/Solid bugs, generic core behavior, pagination,
and dependency dashboards. They are excluded here unless the issue is filed
against `angular-query` or directly affects an Angular-specific API or build.

## Release-blocking summary

The original audit identified these Angular correctness risks (local implementation status below
does not assert that upstream issues have been closed):

- **#11176:** locally fixed by removing the extra Angular notification wrapper
  and covered by a permanent regression test. #9020 is not currently
  reproducible in the exact lifecycle test after the same changes.
- **#9735:** same-turn cache and options behavior now has synchronous subscription coverage,
  including imperative methods invoked before the options effect runs.
- **#9981 / #9910 / #10046:** exact test regressions still need to be preserved
  or explicitly closed after reproducing them on the current package.

The stable-release and devtools issues are release-process blockers, not
evidence that the core Angular signal API is unusable. The Angular helpers now
require an injection context; callers that need delayed invocation must use
Angular's `runInInjectionContext` outside the adapter API.
