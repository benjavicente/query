---
id: CreateInfiniteQueryResult
title: CreateInfiniteQueryResult
---

```ts
type CreateInfiniteQueryResult<TData, TError, TState> = BaseInfiniteQueryNarrowing<TData, TError> & MapToSignals<TState, MethodKeys<TState>>;
```

Defined in: [packages/angular-query/src/types.ts:220](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L220)

## Type Parameters

### TData

`TData` = `unknown`

### TError

`TError` = `DefaultError`

### TState

`TState` *extends* `InfiniteQueryObserverResult`\<`TData`, `TError`\> = `InfiniteQueryObserverResult`\<`TData`, `TError`\>
