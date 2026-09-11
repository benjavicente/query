# Angular adapter comparison with upstream

Measured against freshly fetched `upstream/main` at `c07c1f512d565e17f9d7566deb27c50ea0dfb3ac`, using the current adapter at `2b0436c761ce618967018b12bd3dba70f7e0824e`. Upstream is TanStack/query; its adapter is still named `angular-query-experimental`.

The current adapter has fewer physical source lines, but more implementation code, more tests, and larger bundles. This is a broader, more consistent Angular integration, not a reduction in total implementation size. Fewer compatibility paths and a shared subscription helper coexist with new hydration/resource functionality and more explicit lifecycle handling.

## Source size

Only TypeScript under each package's `src` is counted. Implementation includes public types, imports, exports, and punctuation; it excludes tests. Code lines contain at least one non-comment TypeScript token. Physical lines include comments and blank lines. Documentation, examples, generated output, configuration, and schematics are excluded.

Upstream's embedded devtools are separated from the core adapter for comparison with the current standalone devtools package. Test helpers are counted separately. Test LOC is a maintenance-size measure, not coverage or a count of executed cases.

| Area | Upstream code lines | Current code lines | Change |
| --- | ---: | ---: | ---: |
| Core implementation | 1,594 | 2,161 | +35.6% |
| Core runtime tests | 3,599 | 6,113 | +69.9% |
| Core type tests | 1,327 | 1,413 | +6.5% |
| Devtools implementation | 296 | 302 | +2.0% |
| Devtools runtime tests | 695 | 692 | -0.4% |
| Persistence implementation | 58 | 69 | +19.0% |
| Persistence runtime tests | 387 | 753 | +94.6% |
| **All implementation** | **1,948** | **2,532** | **+30.0%** |

| Core adapter measure | Upstream | Current | Change |
| --- | ---: | ---: | ---: |
| Implementation files | 19 | 25 | +31.6% |
| Physical implementation lines | 3,407 | 2,811 | -17.5% |
| Implementation code lines | 1,594 | 2,161 | +35.6% |

Core runtime test files increase from 15 to 17; type test files increase from 8 to 9. Core test-helper code decreases from 63 to 57 lines, and the standalone devtools package adds an 18-line test helper. These figures include lifecycle, hydration, and Zone.js tests in `src`; no tests were rerun merely to count their lines.

The physical-line reduction is largely a documentation/formatting effect: code grows by 567 lines while comment-only and blank lines fall by 1,163. It should not be presented as a 17.5% implementation reduction.

## Bundle estimates

Identical esbuild 0.27.4 settings: bundled ESM, browser platform, ES2022 target, minification, `ngDevMode=false`, production NODE_ENV, gzip level 9. Both use the **same current Query Core source**, bundled to allow normal tree-shaking. Angular and other package imports remain external. The upstream `injectQueries` experimental entrypoint is included in the full API measurement to match the current main entrypoint.

These are controlled consumer-entry estimates, not an Angular CLI application's final production chunks. They omit Angular, RxJS implementation, devtools UI, persistence, source maps, and declarations. Holding Query Core fixed isolates adapter changes from upstream dependency drift. Full API includes Query Core's re-exported API as well as the Angular adapter API.

| Entry | Upstream minified bytes | Current minified bytes | Upstream gzip bytes | Current gzip bytes | Gzip change |
| --- | ---: | ---: | ---: | ---: | ---: |
| injectQuery | 33,165 | 34,222 | 10,029 | 10,326 | +297 (+3.0%) |
| injectQuery + provideTanStackQuery | 33,465 | 37,675 | 10,150 | 11,424 | +1,274 (+12.6%) |
| Full core adapter + Query Core API | 46,823 | 49,172 | 13,815 | 14,647 | +832 (+6.0%) |

The provider entry has a larger increase than `injectQuery` alone. This is consistent with the provider now importing automatic hydration/dehydration and Angular TransferState integration. That attribution is from source inspection and the entrypoint comparison, not an isolated hydration ablation benchmark.

An additional full-API build with Query Core external measured 8,484 → 10,537 minified bytes and 2,794 → 3,688 gzip bytes: **+894 gzip bytes (+32.0%) for the adapter-only full API**. Do not subtract or add independently compressed sizes to estimate an application bundle. Partial-import measurements with external Query Core were discarded because its wildcard re-export kept barrel namespace code alive and distorted tree-shaking.

## Narrow performance experiment

This measures only the actual old/new `signalProxy` implementations with Angular 20.3.18, Node 24.17.0, and development mode disabled. Both map the same signal with 24 fields, matching the number of current query result fields. Two warm-up rounds precede nine measured rounds, with alternating implementation order. Creation/update rounds perform 20,000 operations; cached-read rounds perform 1,000,000. Values below are medians in microseconds per operation.

| Operation | Upstream µs | Current µs | Current / upstream |
| --- | ---: | ---: | ---: |
| Create mapped object, read one field | 0.142 | 0.828 | 5.82× |
| Create mapped object, read all 24 fields | 3.393 | 2.546 | 0.75× |
| Update existing source, read one field | 0.204 | 0.187 | 0.91× |
| Read unchanged field on existing object | 0.051 | 0.028 | 0.55× |

The current mapper allocates 24 computed signals at creation; upstream lazily creates only fields accessed through its Proxy. This explains the creation cost when only one field is used. Once created, the ordinary object avoids Proxy getter overhead. Update timings are noisy and should not be used to claim a stable application speedup.

This benchmark excludes QueryObserver work, external-store subscription setup, Angular rendering, Zone.js, network activity, retained heap size, and SSR. It establishes neither overall adapter speed nor memory consumption. Timing test suites is also not a valid comparison because the suites and coverage differ substantially.

Before optimizing performance further, the useful next experiment is an Angular component benchmark with 1/100/1,000 queries, one versus several template fields per query, repeated cache updates, and mount/destroy cycles. Measure initial render, settled update time, subscriptions, and retained heap in both zoneless and Zone.js modes. The field mapper's creation cost is the clearest candidate to investigate; preserve the agreed ordinary-object API unless the application benchmark justifies another design.

## Features and behavior

| Area | Upstream adapter | Current adapter |
| --- | --- | --- |
| Angular support | 16+ with compatibility paths | 20.1+ using native lifecycle APIs |
| Core querying | Queries, infinite queries, mutations, cache utilities | Preserved |
| Parallel queries | Experimental subpath | Main package export; explicit methods and typed combine results |
| External-store integration | Separate subscription/signal paths | Shared helper; reads can activate and obtain current snapshots before effects run |
| Result fields | Runtime Proxy; field signals created on access | Ordinary object with declared field signals and explicit methods |
| SSR hydration | Application-managed dehydrate/hydrate | Automatic TransferState hydration, opt-out, configurable key |
| Resource integration | No adapter resource conversion | `toResource`, including error-on-value-read semantics |
| Async stability | Existing PendingTasks compatibility handling | Native PendingTasks with dependent-query and mutation invocation lifecycle handling |
| Error reporting | Observer throwOnError may report through NgZone | Error signals; explicit cache callbacks/ErrorHandler integration; resource read errors |
| Zone.js | Zone use across observer/reporting paths | Narrow zone entry retained for pending-task cleanup |
| Activity filters | Inconsistent query/mutation argument forms | Reactive callbacks for both |
| Client setup | Instance-based setup and multiple helper APIs | Factory/token setup through one environment provider |
| Injection context | Optional injector arguments on helpers | Angular injection context; explicit runInInjectionContext when needed |
| Mutation-state equality | Deep structural sharing of selections | Shallow comparison preserving selected object identities |
| Devtools | Embedded package entrypoints | Standalone package; nullable conditional panel host |
| Persistence | Static options; restoration signal allocated with feature | Browser-only DI factory; restoration state per injector; public provider hides token |
| Public compatibility | Deprecated aliases and older Angular support | Intentionally removed in this breaking migration |

Not all differences are additions: removing observer-level `throwOnError`, old Angular support, injector overloads, and deprecated helpers reduces API surface. Query Core's normal caching, invalidation, retries, and structural sharing remain available; removing adapter-specific deep equality does not remove Query Core structural sharing.

## Assessment

The measurable result is a larger, more explicit implementation with expanded Angular integration and tests. The cost for a consumer using `injectQuery` alone is modest in this controlled build (+297 gzip bytes); the provider and full feature surface cost more. The strongest simplification claim is API/lifecycle consistency and fewer compatibility mechanisms, not less code or universally faster execution.
