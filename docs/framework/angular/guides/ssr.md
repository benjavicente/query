---
id: ssr
title: SSR
---

For [Angular's SSR](https://angular.dev/guide/ssr), you can run queries on the server, embed the serialized cache in the HTML response, and **hydrate** the same data in the browser so the client does not refetch immediately.

To wire that up with TanStack Query correctly, you will need `withHydration` and `provideServerTanStackQueryHydration`.

An end-to-end sample lives at `examples/angular/ssr`; **SSR plus `localStorage` persistence** (factory-only on the client, optional `dehydrateOptions`, and a client-only query mounted with `afterNextRender` in `examples/angular/ssr-persist`) builds on that setup.

## Client application config

Import **`withHydration`** add it to [`provideTanStackQuery`](../reference/functions/provideTanStackQuery.md) in your app config.

```ts
import type { ApplicationConfig } from '@angular/core'
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser'
import {
  QueryClient,
  provideTanStackQuery,
  withHydration,
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
    provideTanStackQuery(queryClient, withDevtools(), withHydration()),
  ],
})

export const getClientAppConfig = () =>
  getBaseAppConfig(createBrowserQueryClient())
```

## Server application config

Import **`provideServerTanStackQueryHydration`** and add it to the config you use for SSR (often merged with the browser config).

Each SSR request should bootstrap a new application with a **fresh** `QueryClient`. The server entry typically exports a **`bootstrap` function**; use that to build config on each request instead of reusing a single static `ApplicationConfig` with one shared client.

```ts
import type { BootstrapContext } from '@angular/platform-browser'
import { mergeApplicationConfig } from '@angular/core'
import { provideServerRendering, withRoutes } from '@angular/ssr'
import { QueryClient } from '@benjavicente/angular-query-experimental'
import { provideServerTanStackQueryHydration } from '@benjavicente/angular-query-experimental/server'
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
    providers: [
      provideServerRendering(withRoutes(serverRoutes)),
      provideServerTanStackQueryHydration(),
    ],
  })
```

Then passes the context into your server config builder so it runs once per bootstrap (per request):

```ts
const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(SsrExampleComponent, getServerConfig(context), context)
```

## Example

The [Angular SSR example](https://github.com/TanStack/query/tree/main/examples/angular/ssr) in this repository combines `withHydration`, `provideServerTanStackQueryHydration`, and a merged server config with route-level rendering.

## See also

- [Angular HttpClient and data fetching](../angular-httpclient-and-other-data-fetching-clients.md) — contrast with HttpClient’s built-in SSR request cache.
