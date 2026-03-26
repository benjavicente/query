---
id: provideTanStackQuery
title: provideTanStackQuery
---

# Function: provideTanStackQuery()

```ts
function provideTanStackQuery(queryClient, ...features): (Provider | EnvironmentProviders)[];
```

Defined in: [providers.ts:111](https://github.com/benjavicente/query/blob/main/packages/angular-query-experimental/src/providers.ts#L111)

Sets up providers necessary to enable TanStack Query functionality for Angular applications.

Allows to configure a `QueryClient` and optional features such as developer tools.

**Example - standalone**

```ts
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental'

bootstrapApplication(AppComponent, {
  providers: [provideTanStackQuery(new QueryClient())],
})
```

**Example - NgModule-based**

```ts
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental'

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  providers: [provideTanStackQuery(new QueryClient())],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

You can also enable optional developer tools by adding `withDevtools` from
`@tanstack/angular-query-devtools`. That package uses conditional exports: optimized builds
typically resolve a no-op stub, while dev servers resolve the real implementation (see the
Angular Devtools guide). When the real implementation runs, devtools mount when `loadDevtools` is
omitted, true, or `'auto'` and `isDevMode()` is true.
```ts
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental'
import { withDevtools } from '@tanstack/angular-query-devtools'

bootstrapApplication(AppComponent, {
  providers: [provideTanStackQuery(new QueryClient(), withDevtools())],
})
```

**Example: using an InjectionToken**

```ts
export const MY_QUERY_CLIENT = new InjectionToken('', {
  factory: () => new QueryClient(),
})

// In a lazy loaded route or lazy loaded component's providers array:
providers: [provideTanStackQuery(MY_QUERY_CLIENT)]
```
Using an InjectionToken for the QueryClient is an advanced optimization which allows TanStack Query to be absent from the main application bundle.
This can be beneficial if you want to include TanStack Query on lazy loaded routes only while still sharing a `QueryClient`.

Note that this is a small optimization and for most applications it's preferable to provide the `QueryClient` in the main application config.

## Parameters

### queryClient

A `QueryClient` instance, or an `InjectionToken` which provides a `QueryClient`.

`QueryClient` | `InjectionToken`\<`QueryClient`\>

### features

...[`QueryFeatures`](../type-aliases/QueryFeatures.md)[]

Optional features to configure additional Query functionality.

## Returns

(`Provider` \| `EnvironmentProviders`)[]

A set of providers to set up TanStack Query.

## See

 - https://tanstack.com/query/v5/docs/framework/angular/quick-start
 - https://tanstack.com/query/v5/docs/framework/angular/devtools
 - https://tanstack.com/query/latest/docs/framework/angular/guides/ssr
