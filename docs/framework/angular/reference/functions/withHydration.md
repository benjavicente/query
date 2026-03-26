---
id: withHydration
title: withHydration
---

# Function: withHydration()

```ts
function withHydration(): HydrationFeature;
```

Defined in: [with-hydration.ts:21](https://github.com/TanStack/query/blob/main/packages/angular-query-experimental/src/with-hydration.ts#L21)

Hydrates the QueryClient in the browser.
Use `provideServerTanStackQueryHydration` from `@tanstack/angular-query-experimental/server`
in your server config to serialize the query cache for dehydration.

## Returns

[`HydrationFeature`](../type-aliases/HydrationFeature.md)
