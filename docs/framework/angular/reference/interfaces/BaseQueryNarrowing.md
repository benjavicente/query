---
id: BaseQueryNarrowing
title: BaseQueryNarrowing
---

# Interface: BaseQueryNarrowing\<TData, TError\>

Defined in: [packages/angular-query/src/types.ts:64](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L64)

## Type Parameters

### TData

`TData` = `unknown`

### TError

`TError` = `DefaultError`

## Properties

### isError()

```ts
isError: (this) => this is CreateBaseQueryResult<TData, TError, CreateStatusBasedQueryResult<"error", TData, TError>>;
```

Defined in: [packages/angular-query/src/types.ts:72](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L72)

#### Parameters

##### this

[`CreateBaseQueryResult`](../type-aliases/CreateBaseQueryResult.md)\<`TData`, `TError`\>

#### Returns

`this is CreateBaseQueryResult<TData, TError, CreateStatusBasedQueryResult<"error", TData, TError>>`

***

### isPending()

```ts
isPending: (this) => this is CreateBaseQueryResult<TData, TError, CreateStatusBasedQueryResult<"pending", TData, TError>>;
```

Defined in: [packages/angular-query/src/types.ts:79](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L79)

#### Parameters

##### this

[`CreateBaseQueryResult`](../type-aliases/CreateBaseQueryResult.md)\<`TData`, `TError`\>

#### Returns

`this is CreateBaseQueryResult<TData, TError, CreateStatusBasedQueryResult<"pending", TData, TError>>`

***

### isSuccess()

```ts
isSuccess: (this) => this is CreateBaseQueryResult<TData, TError, CreateStatusBasedQueryResult<"success", TData, TError>>;
```

Defined in: [packages/angular-query/src/types.ts:65](https://github.com/TanStack/query/blob/main/packages/angular-query/src/types.ts#L65)

#### Parameters

##### this

[`CreateBaseQueryResult`](../type-aliases/CreateBaseQueryResult.md)\<`TData`, `TError`\>

#### Returns

`this is CreateBaseQueryResult<TData, TError, CreateStatusBasedQueryResult<"success", TData, TError>>`
