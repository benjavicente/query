---
id: BaseMutationNarrowing
title: BaseMutationNarrowing
---

# Interface: BaseMutationNarrowing\<TData, TError, TVariables, TOnMutateResult\>

Defined in: [packages/angular-query/src/types.ts:262](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L262)

## Type Parameters

### TData

`TData` = `unknown`

### TError

`TError` = `DefaultError`

### TVariables

`TVariables` = `unknown`

### TOnMutateResult

`TOnMutateResult` = `unknown`

## Properties

### isError

```ts
isError: SignalFunction<(this) => this is CreateMutationResult<TData, TError, TVariables, TOnMutateResult, Override<MutationObserverErrorResult<TData, TError, TVariables, TOnMutateResult>, { mutate: CreateMutateFunction<TData, TError, TVariables, TOnMutateResult> }> & { mutateAsync: CreateMutateAsyncFunction<TData, TError, TVariables, TOnMutateResult> }>>;
```

Defined in: [packages/angular-query/src/types.ts:285](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L285)

***

### isIdle

```ts
isIdle: SignalFunction<(this) => this is CreateMutationResult<TData, TError, TVariables, TOnMutateResult, Override<MutationObserverIdleResult<TData, TError, TVariables, TOnMutateResult>, { mutate: CreateMutateFunction<TData, TError, TVariables, TOnMutateResult> }> & { mutateAsync: CreateMutateAsyncFunction<TData, TError, TVariables, TOnMutateResult> }>>;
```

Defined in: [packages/angular-query/src/types.ts:319](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L319)

***

### isPending

```ts
isPending: SignalFunction<(this) => this is CreateMutationResult<TData, TError, TVariables, TOnMutateResult, Override<MutationObserverLoadingResult<TData, TError, TVariables, TOnMutateResult>, { mutate: CreateMutateFunction<TData, TError, TVariables, TOnMutateResult> }> & { mutateAsync: CreateMutateAsyncFunction<TData, TError, TVariables, TOnMutateResult> }>>;
```

Defined in: [packages/angular-query/src/types.ts:302](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L302)

***

### isSuccess

```ts
isSuccess: SignalFunction<(this) => this is CreateMutationResult<TData, TError, TVariables, TOnMutateResult, Override<MutationObserverSuccessResult<TData, TError, TVariables, TOnMutateResult>, { mutate: CreateMutateFunction<TData, TError, TVariables, TOnMutateResult> }> & { mutateAsync: CreateMutateAsyncFunction<TData, TError, TVariables, TOnMutateResult> }>>;
```

Defined in: [packages/angular-query/src/types.ts:268](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L268)
