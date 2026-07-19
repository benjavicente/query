# @benjavicente/angular-query-devtools

Developer tools for `@benjavicente/angular-query`.

```sh
pnpm add -D @benjavicente/angular-query-devtools
```

```ts
import { QueryClient, provideTanStackQuery } from '@benjavicente/angular-query'
import { withDevtools } from '@benjavicente/angular-query-devtools'

export const appConfig: ApplicationConfig = {
  providers: [provideTanStackQuery(() => new QueryClient(), withDevtools())],
}
```

The default import resolves to a stub in production builds. To opt in to the
real implementation in production, import `withDevtools` from
`@benjavicente/angular-query-devtools/production`.

The options callback runs inside an Angular injection context, so it can call
`inject()` and read signals directly.
