---
id: provideIsRestoring
title: provideIsRestoring
---

```ts
function provideIsRestoring(isRestoring): Provider;
```

Defined in: [packages/angular-query/src/inject-is-restoring.ts:33](https://github.com/TanStack/query/blob/main/packages/angular-query/src/inject-is-restoring.ts#L33)

Provides the signal that tracks restoration for persistence or custom integrations.
A factory runs once per injector in an Angular injection context.

## Parameters

### isRestoring

A restoration signal or a factory that creates it.

`Signal`\<`boolean`\> | () => `Signal`\<`boolean`\>

## Returns

`Provider`

Provider for the `isRestoring` signal
