# Angular issue verification — 2026-09-10

**A blanket claim that this adapter resolves every Angular-related issue is not supported.** The nine open Angular runtime/type issues have matching passing local coverage, including fresh reproductions and both browser timing examples. However, two older Angular-related failure modes are reproducible, upstream release work remains, and some historical runner/site issues were not independently replayed.

Reviewed commit: `2b0436c76` on `angular-release/scoped-publishing`. The implementation was not changed during this audit. Added `upstream-issues.test.ts` and included it in the Zone.js test configuration. The three #6414 cases are explicitly marked `it.fails`: they are known failures, not fixed behavior.

## Scope and search

Queried GitHub with `gh`, including issue bodies and comments; did not post comments or change issue states.

```sh
gh issue list --repo TanStack/query --state all --search 'angular in:title,body' --limit 500 --json number,title,state,url,labels,updatedAt
gh issue list --repo TanStack/query --state all --search 'label:"package: angular-query","package: angular-query-experimental","package: angular-query-devtools","package: angular-query-devtools-experimental"' --limit 500 --json number,title,state,url,labels,updatedAt
gh issue list --repo TanStack/query --state all --search 'angular in:comments' --limit 500 --json number,title,state,url
gh issue list --repo TanStack/query --state all --search 'injectQuery OR injectQueries OR injectMutation in:title' --limit 500 --json number,title,state,url
```

Title/body search returned 53 issues; Angular package labels returned 36, all already among those 53. Comment search added five. Reviewed all **58 candidates**, excluded four incidental matches, and identified **11 currently open Angular issues: nine correctness/type issues and two release trackers**. An additional persistence-label search returned no issues. This is a reproducible search scope, not a guarantee that an unlabelled issue never mentioning Angular could be discovered.

“Verified” below means the stated local behavior passed. “Covered” means related implementation/tests passed without replaying the exact external project. GitHub CLOSED is not treated as proof of a local fix.

## Remaining findings

### 1. Direct QueryClient methods still race reactive query keys (#6414)

[#6414](https://github.com/TanStack/query/issues/6414) is a closed Vue issue whose comments explicitly report the same Angular problem. It was missing from the old local inventory.

After `key.set('bar')`, immediately calling any of `client.invalidateQueries`, `client.refetchQueries`, or `client.resetQueries` executes a query function with key `foo` while a signal read returns `bar`:

```text
Expected (queryKey[1], signal): (foo, foo), (bar, bar)
Observed:                     (foo, foo), (foo, bar), (bar, bar)
```

This causes an extra request and can cache data for the new parameter under the old key when `queryFn` reads the live signal. The adapter applies options in an Angular effect in [inject-base-query.ts](packages/angular-query/src/inject-base-query.ts). Its result methods refresh options through `getObserver()`, but direct QueryClient calls do not use that path. This is distinct from the supported, tested `query.refetch()` fix for #9174.

Reproduction: the three final tests in [upstream-issues.test.ts](packages/angular-query/src/__tests__/upstream-issues.test.ts). They first failed normally with the observed sequence above, then were retained as explicit expected failures. Reading fetch parameters from the query function's `queryKey` avoids mixing identities, but does not eliminate the extra old-key fetch. This contract needs a deliberate fix or documented limitation before claiming all related problems are solved.

### 2. Shared devtools declarations still require undeclared Solid types (#6153 variant)

The freshly rebuilt `packages/query-devtools/build/index.d.ts` starts with `import "solid-js";`. Angular devtools' public declarations import types from that package, while `solid-js` is only a devDependency of the shared package. An isolated consumer using the packed Angular adapter/devtools, copied shared build artifacts and Angular/RxJS dependencies, with no Solid installation, fails:

```text
TS2882: Cannot find module or type declarations for side-effect import of 'solid-js'.
```

The consumer uses TypeScript 6.0.3, `skipLibCheck: false`, and `noUncheckedSideEffectImports: true`. Removing only that import in the isolated fixture makes the same compile pass. Repository source was not edited for this control.

This reproduces the undeclared-dependency symptom of [#6153](https://github.com/TanStack/query/issues/6153), through a side-effect declaration import rather than the original public Solid fields. [tsdown.config.ts](packages/query-devtools/tsdown.config.ts) explicitly preserves Solid imports in declarations. Splitting the Angular devtools package alone does not resolve this build-level leak.

### 3. Release/package checks are not all green

- [#8703](https://github.com/TanStack/query/issues/8703) and [#8713](https://github.com/TanStack/query/issues/8713) remain open. Local package names are `@benjavicente/angular-query`, `@benjavicente/angular-query-devtools`, and `@benjavicente/angular-query-persist-client`; building them does not publish upstream stable packages.
- All three packed artifacts pass strict `publint`. Strict `attw` exits 1 for the adapter and persister because CommonJS resolves to ESM. Their ESM/bundler resolutions pass. Devtools passes with the existing `--ignore-rules cjs-resolves-to-esm` setting. Align the other package checks with the intended ESM-only support policy, or provide the claimed CommonJS support. Do not report an unqualified clean package-check result.
- [#9536](https://github.com/TanStack/query/issues/9536): the Angular community-projects page is still missing from this checkout.
- [Installation](docs/framework/angular/installation.md) still says Angular v20+, but package peers and migration docs require **20.1+**.
- #7022/#8839 are resolved by an intentional API change: automatic observer `throwOnError` reporting was removed, not preserved. Consumers need the documented cache-callback ErrorHandler migration.

## All open Angular issues

| Issue | Local verdict | Evidence / limit |
| --- | --- | --- |
| [#7488](https://github.com/TanStack/query/issues/7488) — [angular-query]  Accessing `.data` kicks off the `CreateQueryOptions` function | Verified locally | Required-input data alias stays lazy; options factory runs only after the input is set. Existing alias coverage plus explicit #7488 test. |
| [#8703](https://github.com/TanStack/query/issues/8703) — Stable release of `@tanstack/angular-query` and `@tanstack/angular-query-devtools` packages | Not complete | Stable-release tracker still open; local manifests publish under @benjavicente, not upstream @tanstack. |
| [#8704](https://github.com/TanStack/query/issues/8704) — Angular: fix `injectQueries` | Covered by implementation and suites | Main-package export, reactive query lists, combine, result identity, cleanup, restoration, stability and declaration tests pass. |
| [#8713](https://github.com/TanStack/query/issues/8713) — Angular: publish stable package and deprecate experimental package | Not complete | Stable publication and experimental-package deprecation require upstream release actions. |
| [#8984](https://github.com/TanStack/query/issues/8984) — Angular: no type narrowing on infinite query status | Verified locally | Infinite-query declaration suite narrows data after isSuccess(), and error/pending branches. All six TypeScript compiler targets pass. |
| [#9020](https://github.com/TanStack/query/issues/9020) — Angular: injectMutation skips pending state when triggered in constructor or ngOnInit | Verified locally and in Chrome | Constructor, ngOnInit and ngAfterContentInit immediately show pending, then success when the promise settles. |
| [#9735](https://github.com/TanStack/query/issues/9735) — Angular query: Optimistic updates are not synchronous | Verified locally and in Chrome | Cache and signal both equal new title inside onMutate, after editing=false, in a microtask, and at the animation frame. |
| [#9910](https://github.com/TanStack/query/issues/9910) — Reading out query signals in template causes test failure | Verified equivalent reproduction | Template isSuccess() plus detectChanges → whenStable → detectChanges resolves data and renders true. |
| [#9981](https://github.com/TanStack/query/issues/9981) — `isSuccess()` not triggering `effect()` during testing | Verified equivalent reproduction | OnPush component effect updates a component value after isSuccess, using TestBed and Testing Library on Angular 20. Original FormControl/Chromium runner not replayed. |
| [#10046](https://github.com/TanStack/query/issues/10046) — Weird bug with Angular unit tests | Verified equivalent reproduction | A class-field query.data alias resolves and renders after whenStable; original application not replayed. |
| [#11176](https://github.com/TanStack/query/issues/11176) — Angular: whenStable() resolves while a mutation started with mutate() is still running | Verified locally | Real-timer issue reproduction passes. Additional overlap/reset cases keep stability blocked until all invocations settle. |

## Verification performed

- Existing Angular suite before adding audit cases: **301 passed**, no type errors; Zone.js project: **132 passed**, no type errors. These counts include declaration cases and overlap across configurations; they are not counts of unique runtime tests.
- Final main suite: **315 passed, 3 expected failures**, no type errors. Final Zone.js project: **146 passed, 3 expected failures**, no type errors. The new focused file contributes **14 passing tests and 3 known failures** in each mode.
- Six compiler builds pass: TypeScript **5.6, 5.7, 5.8, 5.9, current 6.0.3, and 7.0.2**.
- Angular devtools: **32 passed**, including a rerun after rebuilding the adapter; persistence: **13 passed**; schematics: **3 passed**.
- Angular adapter, Angular devtools, persistence, and shared devtools builds succeed. Strict artifact checks have the exceptions described above.
- Production bundle experiment: importing default Angular devtools under production conditions produced a **284-byte stub graph**, with no real shared devtools input. Explicit `/production` produced a **419,155-byte graph** containing real devtools. These are unminified isolated probes with Angular/adapter externalized, not application bundle-size promises.
- Ran both existing timing apps against the current built adapter in Chrome, Angular **20.3.18**. #9735's four recorded phases all showed `cache=new title, signal=new title`, and the rendered title was current. For #9020, constructor/OnInit/AfterContentInit all showed `pending=true` during the five-second request, then success.
- Additional Angular **21.2.22** runtime checks pass in both zoneless and Zone.js modes: **13 passed, 3 expected failures, 1 skipped** each. The skipped Testing Library case requires linking Angular 21 RouterTestingModule, which this checkout's Angular 20 compiler cannot process. The TestBed effect reproduction does pass on Angular 21. This is a runtime check using the existing compiler, not a full Angular 21 build/Chromium certification.

The primary test runtime is Angular **20.3.18**, Vitest **4.1.2**, Node **24.17.0**, TypeScript **6.0.3**. Original external application runners (notably #9981's FormControl/Chromium setup and historical Cypress/Jest configurations) were not all replayed. TestBed equivalents do not establish every browser/test-runner combination.

Useful commands:

```sh
pnpm --dir packages/angular-query run test:lib:both
pnpm --dir packages/angular-query run test:types
pnpm --dir packages/angular-query run test:schematics
pnpm --dir packages/angular-query-devtools run test:lib --run
pnpm --dir packages/angular-query-persist-client run test:lib --run
pnpm --dir examples/angular/optimistic-update-timing start
pnpm --dir examples/angular/mutation-lifecycle-timing start
```

Audit logs, packed artifacts, the strict consumer reproduction, and the production bundle graph are retained in `/tmp/query-angular-audit` and `/tmp/query-angular-*.log` on this machine.

## Every closed Angular-related candidate

These rows deliberately separate current source evidence from external/history-only issues.

| Issue | Assessment | Evidence / remaining verification |
| --- | --- | --- |
| [#6153](https://github.com/TanStack/query/issues/6153) — query-devtools leaking Solid types results in type error in adapter specific dev tools | Reproduced packaging variant | A clean consumer fails TS2882 because shared query-devtools declarations import undeclared solid-js. See findings below. |
| [#6414](https://github.com/TanStack/query/issues/6414) — Query key and reactive value differ after invalidation (Angular also mentioned) | Reproduced | All three QueryClient methods fetch with the old key and new signal value; three explicit expected-failure tests. |
| [#6522](https://github.com/TanStack/query/issues/6522) — Angular demo in the home page does not launch correctly | Historical / external | Homepage demo deployment; the local adapter cannot establish the deployed site is fixed. |
| [#6567](https://github.com/TanStack/query/issues/6567) — Angular Query's data signal is not updating if data is present in the cache | Verified locally | New #6567 test switches between two cached keys and immediately sees the correct data. |
| [#6635](https://github.com/TanStack/query/issues/6635) — Angular Query: type narrowing not working on query and mutation result | Verified locally | Query and mutation status-narrowing declaration suites pass. |
| [#6770](https://github.com/TanStack/query/issues/6770) — Vue docs broken (Angular also mentioned) | Historical / external | Vue issue with an Angular docs-routing comment; deployed documentation redirects were not tested. |
| [#6771](https://github.com/TanStack/query/issues/6771) — Angular Query: Query gets stuck in isRefetching state forever in an edge-case | Verified locally | New #6771 test enables a fresh cached query, immediately refetches, and confirms isRefetching clears. |
| [#7022](https://github.com/TanStack/query/issues/7022) — `throwOnError` does not work with Angular | Intentional breaking change | Observer throwOnError is removed; errors stay in result state. Cache callbacks are the documented ErrorHandler integration. The old behavior is not preserved. |
| [#7023](https://github.com/TanStack/query/issues/7023) — angular-adapter: does not re-render ui on signal changes | Covered by tests | Signal-update tests and Zone.js outside-zone rendering tests pass; original application was not replayed. |
| [#7080](https://github.com/TanStack/query/issues/7080) — Can't test Query mutations using Angular's HttpTestingController | Not independently verified | Original HttpTestingController mutation reproduction was not rerun. Query HTTP tests and the testing guide alone do not prove that exact integration. |
| [#7341](https://github.com/TanStack/query/issues/7341) — queryOptions should to pass initialData with a callback that is potentially returning undefined | Verified locally | query-options.test-d.ts explicitly accepts an initialData factory returning undefined; compiler matrix passes. |
| [#7401](https://github.com/TanStack/query/issues/7401) — [angular] isPending type isn't typed as Signal | Verified locally | Query/mutation status predicates are tested as Angular Signal<boolean>; declaration suites pass. |
| [#7471](https://github.com/TanStack/query/issues/7471) — Should tanstack/query Cache Pages Instead of Fetching on Each Pagination Click? | Configuration question | Closed after configuring staleTime, including prefetches. Cache freshness policy is not an adapter defect. |
| [#7496](https://github.com/TanStack/query/issues/7496) — useQueries data typed as unknown when using skipToken and TypeScript 5.4.5 | Covered by types | Shared React/Vue report discovered during Angular testing; current injectQueries skipToken inference tests pass. |
| [#7829](https://github.com/TanStack/query/issues/7829) — When query in angular version is no long experimental? | Release question | Experimental-label question; upstream stable publication is still a separate action. |
| [#8018](https://github.com/TanStack/query/issues/8018) — Angular query devtools are included in production builds | Verified bundle boundary | Production-condition default devtools import bundles to a stub; explicit /production includes real devtools. |
| [#8022](https://github.com/TanStack/query/issues/8022) — docs: link to typescript page is dead in Angular Query Options | Source addressed | Angular typescript.md exists and has the typing-query-options section; deployed site link was not checked. |
| [#8042](https://github.com/TanStack/query/issues/8042) — Angular injectMutation: `onSuccess` loses type when `queryClient` is passed to `injectMutation` | Changed API; types pass | The old custom QueryClient argument is removed. Callback inference is covered for the supported injection-based API. |
| [#8115](https://github.com/TanStack/query/issues/8115) — Component tests fail when angular-query is used in the component | Not independently verified | Original Cypress component runner was not rerun. Passing Vitest tests do not certify Cypress. |
| [#8318](https://github.com/TanStack/query/issues/8318) — CreateMutationOptions is not exported correctly | Covered by build/types | CreateMutationOptions is exported; generated declarations and compiler matrix pass. |
| [#8364](https://github.com/TanStack/query/issues/8364) — Cannot find module @tanstack/angular-query-experimental in jest test | Not independently verified | Original Jest configuration was not rerun. ESM-only artifacts require compatible Jest configuration; strict ATTW reports CJS resolution. |
| [#8453](https://github.com/TanStack/query/issues/8453) — TypeScript errors when using exported queryOptions factory | Covered by declaration emit | Exported queryOptions declaration regression and TypeScript build matrix pass. |
| [#8475](https://github.com/TanStack/query/issues/8475) — declares 'QueryClient' locally, but it is not exported | Covered by exports/types | The Angular entrypoint re-exports QueryClient from query-core; clean consumer resolves it through the built package. |
| [#8545](https://github.com/TanStack/query/issues/8545) — [Angular query] Queries with enabled: false have their fields not behaving as expected | Source addressed; exact case not rerun | Imperative refetch refreshes options and subscribes before fetching. Disabled-query/current-key tests pass; exact ngOnInit reproduction not replayed. |
| [#8705](https://github.com/TanStack/query/issues/8705) — Angular: support providing TanStack Query and `withDevtools` on lazy loaded routes | Source/tests support it | EnvironmentProviders support route injectors; devtools duplicate-provider tests pass. A lazy-route bundle split was not measured. |
| [#8706](https://github.com/TanStack/query/issues/8706) — Angular: update documentation to reflect stable release | Source addressed; release pending | Stable-name docs and migration guides exist; this branch still builds @benjavicente packages. |
| [#8707](https://github.com/TanStack/query/issues/8707) — Angular: framework version support policy | Policy set; docs mismatch | Peers and migration require Angular >=20.1.0, while installation.md still says v20 and higher. |
| [#8711](https://github.com/TanStack/query/issues/8711) — Angular: injector parameter needs to be made consistent between all functions | Intentional API resolution | Injection helpers consistently require an injection context; custom injector arguments are removed and migrations documented. |
| [#8712](https://github.com/TanStack/query/issues/8712) — Angular: remove deprecated APIs | Source addressed | provideAngularQuery, injectQueryClient, and now provideQueryClient are removed; migration guide reflects this. |
| [#8714](https://github.com/TanStack/query/issues/8714) — Angular: make a decision on what needs to run in the injection context | Decision documented | Providers/devtools/persistence use factory injection contexts; query option callbacks use captured dependencies. This is an API policy, not a runtime fix claim. |
| [#8811](https://github.com/TanStack/query/issues/8811) — Angular: stuck on setQueryData when unset | Caller error / historical | Updater assumes existing data and mutates it. Missing cache data is undefined; the caller must guard it and return immutable updates. |
| [#8824](https://github.com/TanStack/query/issues/8824) — Angular: `withDevtools` option `loadDevtools` no longer supports dependency injection | Verified supported API | withDevtools factory can inject dependencies; direct-injection and reactive injected-service tests pass. |
| [#8833](https://github.com/TanStack/query/issues/8833) — Inferred type references an inaccessible unique symbol type after updating from 5.61.5 to 5.62.0 | Covered by declaration emit | Exported queryOptions/infiniteQueryOptions declaration regressions and compiler builds pass; original project not replayed. |
| [#8839](https://github.com/TanStack/query/issues/8839) — Angular: caught errors in the queryFn do not run in the zone | Intentional breaking change | Automatic observer throwOnError/NgZone error reporting is removed. Cache callbacks replace it; the old automatic-reporting contract is not retained. |
| [#8994](https://github.com/TanStack/query/issues/8994) — Invalid URL in docs/framework/angular/guides/caching.md | Source addressed | Angular caching guide links to ./important-defaults.md, which exists. |
| [#9078](https://github.com/TanStack/query/issues/9078) — Angular: Esbuild always generates chunks for devtools | Verified bundle boundary | Default production graph contains no real devtools input; explicit production subpath is the positive control. |
| [#9174](https://github.com/TanStack/query/issues/9174) — .refetch() is not working as expected  after signal update when using injectQuery | Source/tests support direct refetch | Query refetch refreshes options synchronously; infinite queries share that base. This does not cover direct QueryClient methods, which still fail #6414. |
| [#9525](https://github.com/TanStack/query/issues/9525) — [Angular] Unpublished package used in the basic persister example | Source/package present; publication separate | Scoped persister builds and packs. This does not prove upstream @tanstack publication or repair a deployed example. |
| [#9536](https://github.com/TanStack/query/issues/9536) — Missing Community Projects page for Angular | Still absent locally | No docs/framework/angular/community/community-projects.md page exists. Closing the issue did not add one. |
| [#9744](https://github.com/TanStack/query/issues/9744) — Angular docs: useIsFetching not converted to injectIsFetching in background-fetching-indicators guide | Source addressed | Background-fetching guide includes useIsFetching-to-injectIsFetching replacements and an Angular example. |
| [#9915](https://github.com/TanStack/query/issues/9915) — How to combine two TanStack Query results into a single object? | Usage question / supported alternatives | injectQueries combine tests pass for query options. Existing query results can be composed with computed; the suggested queries-of-results API is not supported. |
| [#9940](https://github.com/TanStack/query/issues/9940) — A mutationKey with input signals causes ngZone errors | Covered; closed by reporter | Required-input mutation option tests pass; reporter closed after updating their reproduction. |
| [#10861](https://github.com/TanStack/query/issues/10861) — deprecate(@tanstack/angular-query-devtools-experimental): in favor of angular-query-experimental | Already closed upstream | GitHub now reports CLOSED; maintainer comment confirms deprecated. Old ISSUES.md status is stale. |

## Excluded search matches

- [#11272](https://github.com/TanStack/query/issues/11272): React useMutationState issue; Angular is cited as a working comparison.
- [#7814](https://github.com/TanStack/query/issues/7814): Renovate dependency dashboard; incidental Angular dependency names.
- [#9537](https://github.com/TanStack/query/issues/9537): Svelte community page; only refers to the Angular issue.
- [#4862](https://github.com/TanStack/query/issues/4862): ESLint query-key factories; AngularJS appears only in an analogy.

## Corrections to prior local notes

[ISSUES.md](ISSUES.md) contains historical observations, not a current verification record. In particular:

- #9735's cache/signal delay and #9020's initial idle state no longer reproduce in the current timing apps.
- #11176 now registers pending work synchronously per invocation, not merely through removal of an observer wrapper; overlap/reset are covered.
- #10861 is closed upstream, not open.
- `provideQueryClient` is removed, contrary to the old inventory's recommendation to retain it.
- The mutation timing README describes a “Start mutation and await whenStable” button and immediate snapshots, but current `src/main.ts` only implements the three lifecycle components. The #11176 automated tests are the usable stability reproduction.
- #6414 and the current #6153 declaration-import variant were not established by that inventory.
