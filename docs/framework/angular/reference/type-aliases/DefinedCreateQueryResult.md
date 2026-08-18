---
id: DefinedCreateQueryResult
title: DefinedCreateQueryResult
---

# Type Alias: DefinedCreateQueryResult\<TData, TError, TState\>

```ts
type DefinedCreateQueryResult<TData, TError, TState> = BaseQueryNarrowing<TData, TError> & MapToSignals<OmitKeyof<TState, keyof BaseQueryNarrowing, "safely">, MethodKeys<OmitKeyof<TState, keyof BaseQueryNarrowing, "safely">>>;
```

Defined in: [packages/angular-query/src/types.ts:171](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L171)

## Type Parameters

### TData

`TData` = `unknown`

### TError

`TError` = `DefaultError`

### TState

`TState` = `DefinedQueryObserverResult`\<`TData`, `TError`\>
