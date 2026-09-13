---
id: CreateMutationResult
title: CreateMutationResult
---

```ts
type CreateMutationResult<TData, TError, TVariables, TOnMutateResult, TState> = BaseMutationNarrowing<TData, TError, TVariables, TOnMutateResult> & MapToSignals<OmitKeyof<TState, keyof BaseMutationNarrowing, "safely">, MethodKeys<OmitKeyof<TState, keyof BaseMutationNarrowing, "safely">>>;
```

Defined in: [packages/angular-query/src/types.ts:373](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L373)

## Type Parameters

### TData

`TData` = `unknown`

### TError

`TError` = `DefaultError`

### TVariables

`TVariables` = `unknown`

### TOnMutateResult

`TOnMutateResult` = `unknown`

### TState

`TState` = `CreateStatusBasedMutationResult`\<[`CreateBaseMutationResult`](CreateBaseMutationResult.md)\[`"status"`\], `TData`, `TError`, `TVariables`, `TOnMutateResult`\>
