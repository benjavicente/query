# @benjavicente/angular-query-persist-client

Persistence integration for `@benjavicente/angular-query`.

## Installation

```sh
pnpm add @benjavicente/angular-query-persist-client @tanstack/query-persist-client-core
```

## Usage

```ts
import { QueryClient, provideTanStackQuery } from '@benjavicente/angular-query'
import { withPersistQueryClient } from '@benjavicente/angular-query-persist-client'

export const appConfig: ApplicationConfig = {
  providers: [
    provideTanStackQuery(
      () => new QueryClient(),
      withPersistQueryClient(() => ({
        persistOptions: {
          persister: createAsyncStoragePersister({ storage: localStorage }),
        },
      })),
    ),
  ],
}
```

The factory runs only in the browser and inside an Angular injection context.
This makes it safe to access browser-only storage and inject application
services without sharing persistence state between SSR requests.
