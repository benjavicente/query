---
id: provideTanStackQuery
title: provideTanStackQuery
---

# Function: provideTanStackQuery()

```ts
function provideTanStackQuery(queryClientFactoryOrToken, ...features): EnvironmentProviders;
```

Defined in: [packages/angular-query/src/providers.ts:128](https://github.com/TanStack/query/blob/main/packages/angular-query/src/providers.ts#L128)

Provides a `QueryClient` and optional TanStack Query features.
The factory runs once per injector in Angular's injection context, so it can
call `inject()` and each SSR request can receive an independent cache.

**Example - standalone**

```ts
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query'

bootstrapApplication(AppComponent, {
  providers: [provideTanStackQuery(() => new QueryClient())],
})
```

You can also enable optional developer tools by adding `withDevtools`. By
default the tools will then be loaded when your app is in development mode.

```ts
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query'
import { withDevtools } from '@tanstack/angular-query-devtools'

bootstrapApplication(AppComponent, {
  providers: [
    provideTanStackQuery(() => new QueryClient(), withDevtools()),
  ],
})
```

Use an `InjectionToken` when another provider owns client creation:

```ts
export const MY_QUERY_CLIENT = new InjectionToken('', {
  factory: () => new QueryClient(),
})

providers: [provideTanStackQuery(MY_QUERY_CLIENT)]
```

## Parameters

### queryClientFactoryOrToken

A `QueryClient` factory or an `InjectionToken` that resolves one.

`InjectionToken`\<`QueryClient`\> | () => `QueryClient`

### features

...[`AnyQueryFeature`](../type-aliases/AnyQueryFeature.md)[]

Optional features to configure additional Query functionality.

## Returns

`EnvironmentProviders`

A single EnvironmentProviders value (do not spread into `providers`).

## See

 - https://tanstack.com/query/v5/docs/framework/angular/quick-start
 - https://tanstack.com/query/v5/docs/framework/angular/devtools
 - https://tanstack.com/query/latest/docs/framework/angular/guides/ssr
