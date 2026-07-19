---
id: BaseInfiniteQueryNarrowing
title: BaseInfiniteQueryNarrowing
---

# Interface: BaseInfiniteQueryNarrowing\<TData, TError\>

Defined in: [packages/angular-query/src/types.ts:88](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L88)

## Type Parameters

### TData

`TData` = `unknown`

### TError

`TError` = `DefaultError`

## Properties

### isError()

```ts
isError: (this) => this is CreateInfiniteQueryResult<TData, TError, CreateStatusBasedInfiniteQueryResult<"error", TData, TError>>;
```

Defined in: [packages/angular-query/src/types.ts:99](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L99)

#### Parameters

##### this

[`CreateInfiniteQueryResult`](../type-aliases/CreateInfiniteQueryResult.md)\<`TData`, `TError`\>

#### Returns

`this is CreateInfiniteQueryResult<TData, TError, CreateStatusBasedInfiniteQueryResult<"error", TData, TError>>`

***

### isPending()

```ts
isPending: (this) => this is CreateInfiniteQueryResult<TData, TError, CreateStatusBasedInfiniteQueryResult<"pending", TData, TError>>;
```

Defined in: [packages/angular-query/src/types.ts:106](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L106)

#### Parameters

##### this

[`CreateInfiniteQueryResult`](../type-aliases/CreateInfiniteQueryResult.md)\<`TData`, `TError`\>

#### Returns

`this is CreateInfiniteQueryResult<TData, TError, CreateStatusBasedInfiniteQueryResult<"pending", TData, TError>>`

***

### isSuccess()

```ts
isSuccess: (this) => this is CreateInfiniteQueryResult<TData, TError, CreateStatusBasedInfiniteQueryResult<"success", TData, TError>>;
```

Defined in: [packages/angular-query/src/types.ts:92](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L92)

#### Parameters

##### this

[`CreateInfiniteQueryResult`](../type-aliases/CreateInfiniteQueryResult.md)\<`TData`, `TError`\>

#### Returns

`this is CreateInfiniteQueryResult<TData, TError, CreateStatusBasedInfiniteQueryResult<"success", TData, TError>>`
