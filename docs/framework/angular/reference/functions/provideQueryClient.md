---
id: provideQueryClient
title: provideQueryClient
---

# Function: provideQueryClient()

```ts
function provideQueryClient(queryClientFactoryOrToken): EnvironmentProviders;
```

Defined in: [packages/angular-query/src/providers.ts:70](https://github.com/TanStack/query/blob/main/packages/angular-query/src/providers.ts#L70)

Provides a [https://tanstack.com/query/latest/docs/reference/QueryClient\|QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient|QueryClient)
without additional TanStack Query features. Prefer [provideTanStackQuery](provideTanStackQuery.md)
for application setup; use this function to override the client in a child
injector or in tests.

The factory is registered with Angular's `useFactory`, runs in an injection
context, and creates one client per injector.

## Parameters

### queryClientFactoryOrToken

A `QueryClient` factory or an `InjectionToken` that resolves one.

`InjectionToken`\<`QueryClient`\> | () => `QueryClient`

## Returns

`EnvironmentProviders`

A single EnvironmentProviders value to add to environment `providers` (do not spread).
