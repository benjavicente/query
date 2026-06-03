---
id: QueryFeatures
title: QueryFeatures
---

# Type Alias: QueryFeatures

```ts
type QueryFeatures = 
  | DevtoolsFeature
  | QueryFeature<"Hydration">
  | PersistQueryClientFeature;
```

Defined in: [providers.ts:253](https://github.com/TanStack/query/blob/main/packages/angular-query/src/providers.ts#L253)

A type alias that represents all Query features available for use with `provideTanStackQuery`.
Features can be enabled by adding special functions to the `provideTanStackQuery` call.
See documentation for each symbol to find corresponding function name. See also `provideTanStackQuery`
documentation on how to use those functions.

## See

[provideTanStackQuery](../functions/provideTanStackQuery.md)
