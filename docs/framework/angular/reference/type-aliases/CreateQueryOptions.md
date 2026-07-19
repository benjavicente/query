---
id: CreateQueryOptions
title: CreateQueryOptions
---

# Type Alias: CreateQueryOptions\<TQueryFnData, TError, TData, TQueryKey\>

```ts
type CreateQueryOptions<TQueryFnData, TError, TData, TQueryKey> = OmitKeyof<CreateBaseQueryOptions<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>, "suspense">;
```

Defined in: [packages/angular-query/src/types.ts:30](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L30)

## Type Parameters

### TQueryFnData

`TQueryFnData` = `unknown`

### TError

`TError` = `DefaultError`

### TData

`TData` = `TQueryFnData`

### TQueryKey

`TQueryKey` *extends* `QueryKey` = `QueryKey`
