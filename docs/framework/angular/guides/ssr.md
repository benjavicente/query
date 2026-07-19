---
id: ssr
title: SSR
---

For [Angular SSR](https://angular.dev/guide/ssr), [`provideTanStackQuery`](../reference/functions/provideTanStackQuery.md) serializes the `QueryClient` cache into Angular's `TransferState` and restores it when the browser application starts.

An end-to-end sample lives at `examples/angular/ssr`. The `examples/angular/ssr-persist` example builds on the same setup with browser persistence.

## Query client factory

`provideTanStackQuery` registers the factory with Angular's `useFactory`. It runs once per root injector and in an injection context, so it can call `inject()`. Because Angular SSR creates a root injector for each request, each request gets an independent `QueryClient` and cache.

```ts
import { QueryClient } from '@tanstack/angular-query'

export const SHARED_QUERY_DEFAULTS = {
  staleTime: 1000 * 30,
  gcTime: 1000 * 60 * 60 * 24,
} as const

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...SHARED_QUERY_DEFAULTS,
      },
    },
  })
}
```

## Browser config

Use the factory with `provideTanStackQuery` in your application config. If you want devtools, import them from the standalone devtools package.

```ts
import type { ApplicationConfig } from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser'
import { provideTanStackQuery } from '@tanstack/angular-query'
import { withDevtools } from '@tanstack/angular-query-devtools'
import { createQueryClient } from './query-client'

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideClientHydration(withEventReplay()),
    provideTanStackQuery(createQueryClient, withDevtools()),
  ],
}
```

## Server config

Merge the application config with `provideServerRendering` in the server config.

```ts
import { mergeApplicationConfig } from '@angular/core'
import { provideServerRendering, withRoutes } from '@angular/ssr'
import { appConfig } from './app.config'
import { serverRoutes } from './app.routes.server'

export const serverConfig = mergeApplicationConfig(appConfig, {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
})
```

## Multiple query clients

Built-in hydration uses a default transfer key. For a second `QueryClient` in a child injector, pass a distinct key with `withHydrationKey` so each client's serialized cache stays separate.

```ts
providers: [
  provideTanStackQuery(
    createSecondaryQueryClient,
    withHydrationKey('my-secondary-query-cache'),
  ),
]
```

## Disabling built-in hydration

If you need to opt out of TanStack Query's built-in `TransferState` integration for a specific injector, add `withNoQueryHydration()`.

```ts
providers: [provideTanStackQuery(createQueryClient, withNoQueryHydration())]
```

## See also

- [Angular HttpClient and data fetching](../angular-httpclient-and-other-data-fetching-clients.md)
- [Devtools](../devtools.md)
