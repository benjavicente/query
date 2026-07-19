---
id: CreateInfiniteQueryResult
title: CreateInfiniteQueryResult
---

# Type Alias: CreateInfiniteQueryResult\<TData, TError, TState\>

```ts
type CreateInfiniteQueryResult<TData, TError, TState> = BaseInfiniteQueryNarrowing<TData, TError> & QueryResourceAdapter<TData> & MapToSignals<TState, MethodKeys<TState>>;
```

Defined in: [packages/angular-query/src/types.ts:182](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L182)

## Type Parameters

### TData

`TData` = `unknown`

### TError

`TError` = `DefaultError`

### TState

`TState` = `InfiniteQueryObserverResult`\<`TData`, `TError`\>
