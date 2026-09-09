---
id: DefinedCreateQueryResult
title: DefinedCreateQueryResult
---

```ts
type DefinedCreateQueryResult<TData, TError, TState> = DefinedQueryNarrowing<TData, TError> & MapToSignals<OmitKeyof<TState, keyof DefinedQueryNarrowing, "safely">, MethodKeys<OmitKeyof<TState, keyof DefinedQueryNarrowing, "safely">>>;
```

Defined in: [packages/angular-query/src/types.ts:209](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L209)

## Type Parameters

### TData

`TData` = `unknown`

### TError

`TError` = `DefaultError`

### TState

`TState` *extends* `DefinedQueryObserverResult`\<`TData`, `TError`\> = `DefinedQueryObserverResult`\<`TData`, `TError`\>
