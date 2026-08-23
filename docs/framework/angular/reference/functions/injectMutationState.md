---
id: injectMutationState
title: injectMutationState
---

```ts
function injectMutationState<TResult>(injectMutationStateFn): Signal<TResult[]>;
```

Defined in: [packages/angular-query/src/inject-mutation-state.ts:60](https://github.com/TanStack/query/blob/main/packages/angular-query/src/inject-mutation-state.ts#L60)

Injects a signal that tracks the state of all mutations.

## Type Parameters

### TResult

`TResult` = `MutationState`\<`unknown`, `Error`, `unknown`, `unknown`\>

## Parameters

### injectMutationStateFn

() => [`MutationStateOptions`](../type-aliases/MutationStateOptions.md)\<`TResult`\>

A function that returns mutation state options.

The Angular injector to use.

## Returns

`Signal`\<`TResult`[]\>

The signal that tracks the state of all mutations.
