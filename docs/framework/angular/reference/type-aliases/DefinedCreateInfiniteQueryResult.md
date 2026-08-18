---
id: DefinedCreateInfiniteQueryResult
title: DefinedCreateInfiniteQueryResult
---

# Type Alias: DefinedCreateInfiniteQueryResult\<TData, TError, TDefinedInfiniteQueryObserver\>

```ts
type DefinedCreateInfiniteQueryResult<TData, TError, TDefinedInfiniteQueryObserver> = DefinedInfiniteQueryNarrowing<TData, TError> & MapToSignals<TDefinedInfiniteQueryObserver, MethodKeys<TDefinedInfiniteQueryObserver>>;
```

Defined in: [packages/angular-query/src/types.ts:190](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L190)

## Type Parameters

### TData

`TData` = `unknown`

### TError

`TError` = `DefaultError`

### TDefinedInfiniteQueryObserver

`TDefinedInfiniteQueryObserver` = `DefinedInfiniteQueryObserverResult`\<`TData`, `TError`\>
