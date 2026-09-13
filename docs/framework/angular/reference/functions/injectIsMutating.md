---
id: injectIsMutating
title: injectIsMutating
---

```ts
function injectIsMutating(filters): Signal<number>;
```

Defined in: [packages/angular-query/src/inject-is-mutating.ts:14](https://github.com/TanStack/query/blob/main/packages/angular-query/src/inject-is-mutating.ts#L14)

Injects a signal that tracks the number of mutations that your application is fetching.

Can be used for app-wide loading indicators

## Parameters

### filters

() => `MutationFilters`

A reactive factory for the filters.

## Returns

`Signal`\<`number`\>

A read-only signal with the number of fetching mutations.
