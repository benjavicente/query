---
id: DefinedInfiniteQueryNarrowing
title: DefinedInfiniteQueryNarrowing
---

# Interface: DefinedInfiniteQueryNarrowing\<TData, TError\>

Defined in: [packages/angular-query/src/types.ts:115](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L115)

## Type Parameters

### TData

`TData` = `unknown`

### TError

`TError` = `DefaultError`

## Properties

### isError()

```ts
isError: (this) => this is DefinedCreateInfiniteQueryResult<TData, TError, InfiniteQueryObserverRefetchErrorResult<TData, TError>>;
```

Defined in: [packages/angular-query/src/types.ts:126](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L126)

#### Parameters

##### this

[`DefinedCreateInfiniteQueryResult`](../type-aliases/DefinedCreateInfiniteQueryResult.md)\<`TData`, `TError`\>

#### Returns

`this is DefinedCreateInfiniteQueryResult<TData, TError, InfiniteQueryObserverRefetchErrorResult<TData, TError>>`

***

### isPending()

```ts
isPending: (this) => this is never;
```

Defined in: [packages/angular-query/src/types.ts:133](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L133)

#### Parameters

##### this

[`DefinedCreateInfiniteQueryResult`](../type-aliases/DefinedCreateInfiniteQueryResult.md)\<`TData`, `TError`\>

#### Returns

`this is never`

***

### isSuccess()

```ts
isSuccess: (this) => this is DefinedCreateInfiniteQueryResult<TData, TError, InfiniteQueryObserverSuccessResult<TData, TError>>;
```

Defined in: [packages/angular-query/src/types.ts:119](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L119)

#### Parameters

##### this

[`DefinedCreateInfiniteQueryResult`](../type-aliases/DefinedCreateInfiniteQueryResult.md)\<`TData`, `TError`\>

#### Returns

`this is DefinedCreateInfiniteQueryResult<TData, TError, InfiniteQueryObserverSuccessResult<TData, TError>>`
