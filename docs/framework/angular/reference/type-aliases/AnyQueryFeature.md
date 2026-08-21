---
id: AnyQueryFeature
title: AnyQueryFeature
---

# Type Alias: AnyQueryFeature

```ts
type AnyQueryFeature =
  | DevtoolsFeature
  | QueryFeature<"Hydration">
  | PersistQueryClientFeature;
```

Defined in: [packages/angular-query/src/providers.ts:232](https://github.com/TanStack/query/blob/main/packages/angular-query/src/providers.ts#L232)

A type alias that represents any Query feature available for use with `provideTanStackQuery`.
Features can be enabled by adding special functions to the `provideTanStackQuery` call.

## See

[provideTanStackQuery](../functions/provideTanStackQuery.md)
