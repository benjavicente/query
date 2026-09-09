---
id: injectIsRestoring
title: injectIsRestoring
---

```ts
function injectIsRestoring(): Signal<boolean>;
```

Defined in: [packages/angular-query/src/inject-is-restoring.ts:22](https://github.com/TanStack/query/blob/main/packages/angular-query/src/inject-is-restoring.ts#L22)

Injects a signal that tracks whether a restore is currently in progress. [injectQuery](injectQuery.md) and friends also check this internally to avoid race conditions between the restore and initializing queries.

## Returns

`Signal`\<`boolean`\>

readonly signal with boolean that indicates whether a restore is in progress.
