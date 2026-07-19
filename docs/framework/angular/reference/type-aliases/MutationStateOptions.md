---
id: MutationStateOptions
title: MutationStateOptions
---

# Type Alias: MutationStateOptions\<TResult\>

```ts
type MutationStateOptions<TResult> = object;
```

Defined in: [packages/angular-query/src/inject-mutation-state.ts:23](https://github.com/TanStack/query/blob/main/packages/angular-query/src/inject-mutation-state.ts#L23)

## Type Parameters

### TResult

`TResult` = `MutationState`

## Properties

### filters?

```ts
optional filters: MutationFilters;
```

Defined in: [packages/angular-query/src/inject-mutation-state.ts:24](https://github.com/TanStack/query/blob/main/packages/angular-query/src/inject-mutation-state.ts#L24)

***

### select()?

```ts
optional select: (mutation) => TResult;
```

Defined in: [packages/angular-query/src/inject-mutation-state.ts:25](https://github.com/TanStack/query/blob/main/packages/angular-query/src/inject-mutation-state.ts#L25)

#### Parameters

##### mutation

`Mutation`

#### Returns

`TResult`
