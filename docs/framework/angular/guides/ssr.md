---
id: ssr
title: SSR
---

For [Angular's SSR](https://angular.dev/guide/ssr), you can run queries on the server, embed the serialized cache in the HTML response, and **hydrate** the same data in the browser so the client does not refetch immediately.

[`provideTanStackQuery`](../reference/functions/provideTanStackQuery.md) and [`provideQueryClient`](../reference/functions/provideQueryClient.md) serialize the `QueryClient` cache during SSR and restore it when the browser app boots, so the client can skip immediate refetches for data that was already loaded on the server.

An end-to-end sample lives at `examples/angular/ssr`; **SSR plus `localStorage` persistence** (factory-only on the client, optional `dehydrateOptions`, and a client-only query mounted with `afterNextRender` in `examples/angular/ssr-persist`) builds on that setup.

## Client application config

Use [`provideTanStackQuery`](../reference/functions/provideTanStackQuery.md) (or `provideQueryClient`) in your **application** or **merged** config. Each call returns a single [`EnvironmentProviders`](https://angular.dev/api/core/EnvironmentProviders) value (not for [`@Component({ providers })`](https://angular.dev/api/core/Component#providers)). No separate hydration feature is required.

```ts
import type { ApplicationConfig } from '@angular/core'
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser'
import {
  QueryClient,
  provideTanStackQuery,
} from '@benjavicente/angular-query-experimental'
import { withDevtools } from '@benjavicente/angular-query-devtools'

export const sharedQueryDefaults = {
  staleTime: 1000 * 30,
  gcTime: 1000 * 60 * 60 * 24,
} as const

export const createBrowserQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { ...sharedQueryDefaults },
    },
  })

// This allows the setup to provide an unique query client per request
export const getBaseAppConfig = (
  queryClient: QueryClient,
): ApplicationConfig => ({
  providers: [
    provideClientHydration(withEventReplay()),
    provideTanStackQuery(queryClient, withDevtools()),
  ],
})

export const getClientAppConfig = () =>
  getBaseAppConfig(createBrowserQueryClient())
```

## Server application config

Merge the same base config with [`provideServerRendering`](https://angular.dev/api/ssr/provideServerRendering) (and route setup as needed). You do **not** need a separate TanStack server-only provider for cache dehydration—it runs as part of `provideTanStackQuery` / `provideQueryClient` on the server.

Each SSR request should bootstrap a new application with a **fresh** `QueryClient`. The server entry typically exports a **`bootstrap` function**; use that to build config on each request instead of reusing a single static `ApplicationConfig` with one shared client.

```ts
import type { BootstrapContext } from '@angular/platform-browser'
import { mergeApplicationConfig } from '@angular/core'
import { provideServerRendering, withRoutes } from '@angular/ssr'
import { QueryClient } from '@benjavicente/angular-query-experimental'
import { getBaseAppConfig, sharedQueryDefaults } from './app.config'
import { serverRoutes } from './app.routes.server'

const createServerQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        ...sharedQueryDefaults,
        retry: false,
      },
    },
  })

export const getServerConfig = (_context: BootstrapContext) =>
  mergeApplicationConfig(getBaseAppConfig(createServerQueryClient()), {
    providers: [provideServerRendering(withRoutes(serverRoutes))],
  })
```

Then pass the context into your server config builder so it runs once per bootstrap (per request):

```ts
const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(SsrExampleComponent, getServerConfig(context), context)
```

## Multiple `QueryClient` instances (custom hydration key)

Built-in hydration uses a default key. For a **second** client in a child injector, pass a distinct key via `withHydrationKey` so each client’s serialized cache stays separate:

```ts
providers: [
  provideTanStackQuery(secondaryClient, withHydrationKey('my-secondary-query-cache')),
]
```

## Example

The [Angular SSR example](https://github.com/TanStack/query/tree/main/examples/angular/ssr) in this repository uses merged browser + server application config with route-level rendering and built-in SSR cache hydration.

## See also

- [Angular HttpClient and data fetching](../angular-httpclient-and-other-data-fetching-clients.md) — contrast with HttpClient’s built-in SSR request cache.
