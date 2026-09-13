---
id: injectMutation
title: injectMutation
---

```ts
function injectMutation<TData, TError, TVariables, TOnMutateResult>(optionsFn): CreateMutationResult<TData, TError, TVariables, TOnMutateResult>;
```

Defined in: [packages/angular-query/src/inject-mutation.ts:28](https://github.com/TanStack/query/blob/main/packages/angular-query/src/inject-mutation.ts#L28)

Injects a mutation: an imperative function that can be invoked which typically performs server side effects.

Unlike queries, mutations are not run automatically.

## Type Parameters

### TData

`TData` = `unknown`

### TError

`TError` = `Error`

### TVariables

`TVariables` = `void`

### TOnMutateResult

`TOnMutateResult` = `unknown`

## Parameters

### optionsFn

() => [`CreateMutationOptions`](../interfaces/CreateMutationOptions.md)\<`TData`, `TError`, `TVariables`, `TOnMutateResult`\>

A function that returns mutation options.

## Returns

[`CreateMutationResult`](../type-aliases/CreateMutationResult.md)\<`TData`, `TError`, `TVariables`, `TOnMutateResult`\>

The mutation.
