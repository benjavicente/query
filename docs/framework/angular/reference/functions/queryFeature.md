---
id: queryFeature
title: queryFeature
---

```ts
function queryFeature<TFeatureKind>(kind, providers): QueryFeature<TFeatureKind>;
```

Defined in: [packages/angular-query/src/providers.ts:157](https://github.com/TanStack/query/blob/main/packages/angular-query/src/providers.ts#L157)

Helper function to create an object that represents a Query feature.

## Type Parameters

### TFeatureKind

`TFeatureKind` *extends* `"Hydration"` \| `"Devtools"` \| `"PersistQueryClient"`

## Parameters

### kind

`TFeatureKind`

### providers

`EnvironmentProviders` | `Provider`[]

## Returns

[`QueryFeature`](../interfaces/QueryFeature.md)\<`TFeatureKind`\>

A Query feature.
