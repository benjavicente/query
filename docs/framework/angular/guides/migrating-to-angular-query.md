---
id: migrating-to-angular-query
title: Migrating to Angular Query
---

This guide covers the two supported paths to the stable Angular Query package:

- [`@tanstack/angular-query-experimental`](#migrating-from-tanstackangular-query-experimental)
- [`@ngneat/query` or `@openng/query`](#migrating-from-ngneatquery-or-openngquery)

Angular Query requires Angular 20 or newer. Upgrade Angular before changing Query packages if your
application still uses an earlier version.

## Migrating from `@tanstack/angular-query-experimental`

The stable package keeps the callback-based query, mutation, and signal result APIs from the
experimental adapter. Most application queries therefore only need an import change. The following
sections cover the breaking configuration and entrypoint changes.

### Replace the experimental package

```bash
npm uninstall @tanstack/angular-query-experimental
npm install @tanstack/angular-query
```

Angular 20 or newer is required by the stable package.

```ts
import { injectQuery } from '@tanstack/angular-query-experimental' // [!code --]
import { injectQuery } from '@tanstack/angular-query' // [!code ++]
```

### Provide a client factory

`provideTanStackQuery` no longer accepts a pre-created `QueryClient`. Pass a factory instead.

```ts
provideTanStackQuery(new QueryClient()) // [!code --]
provideTanStackQuery(() => new QueryClient()) // [!code ++]
```

`provideTanStackQuery` now returns one `EnvironmentProviders` value rather than an array. Use it in
an environment injector, such as `ApplicationConfig.providers`, the `providers` passed to
`bootstrapApplication`, route-level `Route.providers`, or `createEnvironmentInjector`. It is not
supported in `@Component.providers` or `@Directive.providers`. Add the result directly; do not
spread it.

```ts
providers: [...provideTanStackQuery(() => new QueryClient())] // [!code --]
providers: [provideTanStackQuery(() => new QueryClient())] // [!code ++]
```

### Remove deprecated provider and injection helpers

`provideAngularQuery` and `injectQueryClient` have been removed.

```ts
provideAngularQuery(new QueryClient()) // [!code --]
provideTanStackQuery(() => new QueryClient()) // [!code ++]
```

```ts
const queryClient = injectQueryClient() // [!code --]
const queryClient = inject(QueryClient) // [!code ++]
```

### Install the standalone devtools package

Devtools no longer ship as entrypoints of the core Angular package.

```bash
npm install @tanstack/angular-query-devtools
```

```ts
import { withDevtools } from '@tanstack/angular-query-experimental/devtools' // [!code --]
import { withDevtools } from '@tanstack/angular-query-devtools' // [!code ++]
```

The production and panel entrypoints move in the same way:

```ts
import { withDevtools } from '@tanstack/angular-query-experimental/devtools/production' // [!code --]
import { withDevtools } from '@tanstack/angular-query-devtools/production' // [!code ++]
```

The devtools options callback now runs in an injection context. Remove the `deps` option and call
`inject()` inside the callback instead.

```ts
const optionsFromManager = (manager: DevtoolsOptionsManager) => ({
  loadDevtools: manager.loadDevtools(),
})

withDevtools(optionsFromManager, { deps: [DevtoolsOptionsManager] }) // [!code --]
withDevtools(() => optionsFromManager(inject(DevtoolsOptionsManager))) // [!code ++]
```

See the [Devtools guide](../devtools.md) for setup, production entrypoints, and configuration
options.

### Use the stable `injectQueries` export

`injectQueries` is now exported from the main package. Its optional explicit injector uses the same
options-object convention as the other injection APIs.

```ts
import {
  injectQueries, // [!code --]
} from '@tanstack/angular-query-experimental/inject-queries-experimental' // [!code --]
import { injectQueries } from '@tanstack/angular-query' // [!code ++]

const getQueries = () => ({ queries })
const results = injectQueries(getQueries, injector) // [!code --]
const results = injectQueries(getQueries, { injector }) // [!code ++]
```

The `queries` callback is reactive, tuple inference is preserved, and `combine` can derive a single
result:

```ts
readonly summary = injectQueries(() => ({
  queries: [todosOptions(), usersOptions()],
  combine: ([todos, users]) => ({
    pending: todos.isPending || users.isPending,
    todoCount: todos.data?.length ?? 0,
    userCount: users.data?.length ?? 0,
  }),
}))
```

### Review SSR hydration

`provideTanStackQuery` now dehydrates the server cache into Angular `TransferState` and hydrates it
in the browser by default. In most SSR applications, no additional setup is necessary.

If your application already performs manual dehydration and hydration, either remove the manual
implementation or disable the built-in behavior to avoid hydrating the same client twice:

```ts
provideTanStackQuery(() => new QueryClient(), withNoQueryHydration())
```

Give each client a unique key when multiple clients use automatic hydration:

```ts
provideTanStackQuery(
  () => new QueryClient(),
  withHydrationKey('admin-query-cache'),
)
```

See the [SSR guide](./ssr.md) for request-scoped client setup and the interaction with Angular
`HttpClient` transfer caching.

### Update tests that wait for stability

Queries, parallel queries, mutations, and persistence restoration now register with Angular's
`PendingTasks`. As a result, `ApplicationRef.whenStable()` and `fixture.whenStable()` wait until
that work settles.

This can change existing tests that expected `whenStable()` to resolve while a request was still in
progress. Make sure mocked requests and mutations resolve or reject before awaiting stability. When
using fake timers, advance the timers and queued microtasks before awaiting `whenStable()`. Disabled
queries do not register pending work.

See [Testing](./testing.md) for query, mutation, `HttpClientTestingController`, and fake-timer
examples.

### New behavior that needs no migration

The stable package also includes the following compatible improvements:

- Query results can be converted into an Angular Resource with `toResource`. See the
  [Resource API](../resource-api.md).
- `injectQueries` is supported from the main package with reactive options and field-level signals.
- Result field signals are created lazily, so options can safely read required input signals without
  being evaluated during class construction.
- Persistence options may be supplied as a browser-only factory, making references such as
  `localStorage` safe in SSR applications.

## Migrating from `@ngneat/query` or `@openng/query`

`@openng/query` is a fork and rename of `@ngneat/query`. The examples use the newer
`@openng/query` name, but the same changes apply to applications that still import
`@ngneat/query`.

### Replace the packages

Remove whichever legacy package name your application uses, along with its devtools package. The
stable adapter includes `@tanstack/query-core` as a dependency, so remove a direct installation
unless your application imports it independently.

```bash
npm uninstall @openng/query @openng/query-devtools @tanstack/query-core
npm install @tanstack/angular-query @tanstack/angular-query-devtools
```

Replace `@openng/query` with `@ngneat/query` in the uninstall command if necessary.

### Configure the `QueryClient`

Replace `provideQueryClientOptions` with a `QueryClient` factory passed to
`provideTanStackQuery`. The factory runs in an Angular injection context, so it can call `inject()`
when building caches or default options.

```ts
import { QueryCache } from '@openng/query' // [!code --]
import { provideQueryClientOptions } from '@openng/query' // [!code --]
import { QueryCache, QueryClient } from '@tanstack/angular-query' // [!code ++]
import { provideTanStackQuery } from '@tanstack/angular-query' // [!code ++]

const queryClientConfig = {
  queryCache: new QueryCache({ onError: handleError }),
}

providers: [
  provideQueryClientOptions(queryClientConfig), // [!code --]
  provideTanStackQuery(() => new QueryClient(queryClientConfig)), // [!code ++]
]
```

### Migrate queries

The legacy `injectQuery()` call returned a function that accepted query options. The stable API
accepts a reactive options callback and returns the query result directly.

```ts
private readonly useQuery = injectQuery() // [!code --]

readonly todos = this.useQuery({ // [!code --]
  queryKey: ['todos'], // [!code --]
  queryFn: fetchTodos, // [!code --]
}) // [!code --]
readonly todos = injectQuery(() => ({ // [!code ++]
  queryKey: ['todos'], // [!code ++]
  queryFn: fetchTodos, // [!code ++]
})) // [!code ++]
```

Read signals inside the callback to update options reactively. This replaces calling
`updateOptions` yourself.

```ts
readonly filter = signal('')
private readonly useQuery = injectQuery() // [!code --]
readonly todos = this.useQuery({ // [!code --]
  queryKey: ['todos', this.filter()], // [!code --]
  queryFn: () => fetchTodos(this.filter()), // [!code --]
}) // [!code --]
readonly todos = injectQuery(() => ({ // [!code ++]
  queryKey: ['todos', this.filter()], // [!code ++]
  queryFn: () => fetchTodos(this.filter()), // [!code ++]
})) // [!code ++]
```

When using an explicit injector, pass it as the second argument:

```ts
injectQuery({ injector })(queryOptions) // [!code --]
injectQuery(() => queryOptions, { injector }) // [!code ++]
```

### Migrate infinite queries and mutations

`injectInfiniteQuery` and `injectMutation` use the same callback pattern:

```ts
private readonly useInfiniteQuery = injectInfiniteQuery() // [!code --]
readonly posts = this.useInfiniteQuery({ // [!code --]
  queryKey: ['posts'], // [!code --]
  queryFn: ({ pageParam }) => fetchPosts(pageParam), // [!code --]
  initialPageParam: 0, // [!code --]
  getNextPageParam: (lastPage) => lastPage.nextId, // [!code --]
}) // [!code --]
readonly posts = injectInfiniteQuery(() => ({ // [!code ++]
  queryKey: ['posts'], // [!code ++]
  queryFn: ({ pageParam }) => fetchPosts(pageParam), // [!code ++]
  initialPageParam: 0, // [!code ++]
  getNextPageParam: (lastPage) => lastPage.nextId, // [!code ++]
})) // [!code ++]
```

```ts
private readonly useMutation = injectMutation() // [!code --]
readonly addTodo = this.useMutation({ // [!code --]
  mutationFn: addTodo, // [!code --]
}) // [!code --]
readonly addTodo = injectMutation(() => ({ // [!code ++]
  mutationFn: addTodo, // [!code ++]
})) // [!code ++]
```

Imperative methods remain direct methods, for example `addTodo.mutate(value)`,
`addTodo.reset()`, `posts.fetchNextPage()`, and `todos.refetch()`.

### Migrate query and mutation results

The legacy adapter exposed one signal and one Observable containing the entire observer result.
The stable adapter exposes each result field as a signal and keeps imperative methods as functions.

```ts
todos.result().isPending // [!code --]
todos.result().data // [!code --]
todos.result().error // [!code --]
todos.isPending() // [!code ++]
todos.data() // [!code ++]
todos.error() // [!code ++]
```

Templates use the field signals in the same way:

```angular-html
@if (todos.result().isPending) { <!-- [!code --] -->
@if (todos.isPending()) { <!-- [!code ++] -->
  <span>Loading...</span>
} @else if (todos.isError()) {
  <span>{{ todos.error()?.message }}</span>
} @else {
  @for (todo of todos.data(); track todo.id) {
    <span>{{ todo.title }}</span>
  }
}
```

There is no direct replacement for `result$`. Convert the field signal you need with Angular's
`toObservable`, or compose several fields with `computed` first.

```ts
readonly todosResult$ = this.todos.result$ // [!code --]
readonly todosState = computed(() => ({ // [!code ++]
  data: this.todos.data(), // [!code ++]
  error: this.todos.error(), // [!code ++]
  status: this.todos.status(), // [!code ++]
})) // [!code ++]
readonly todosResult$ = toObservable(this.todosState) // [!code ++]
```

Mutation state follows the same rule:

```ts
addTodo.result().isPending // [!code --]
addTodo.result().data // [!code --]
addTodo.isPending() // [!code ++]
addTodo.data() // [!code ++]
```

### Convert Observable query functions

The legacy adapter accepted an RxJS `Observable` from `queryFn` and `mutationFn`. The stable
adapter follows TanStack Query's Promise-based contract, so convert an Observable with
`firstValueFrom` or `lastValueFrom`.

```ts
queryFn: () => this.http.get<Todo[]>('/api/todos') // [!code --]
queryFn: () => lastValueFrom(this.http.get<Todo[]>('/api/todos')) // [!code ++]
```

```ts
const createTodo = (todo: Todo) => this.http.post<Todo>('/api/todos', todo)

mutationFn: createTodo // [!code --]
mutationFn: (todo) => lastValueFrom(createTodo(todo)) // [!code ++]
```

See [Angular HttpClient](../angular-httpclient-and-other-data-fetching-clients.md)
for a complete example. If an Observable does not complete, prefer `firstValueFrom` or make it
complete before converting it.

### Migrate background indicators

`injectIsFetching` and `injectIsMutating` now accept filters directly and return a
`Signal<number>`.

```ts
private readonly useIsFetching = injectIsFetching() // [!code --]
readonly fetchingTodos = // [!code --]
  this.useIsFetching({ queryKey: ['todos'] }).toSignal() // [!code --]
readonly fetchingTodos = injectIsFetching({ queryKey: ['todos'] }) // [!code ++]
```

```ts
private readonly useIsMutating = injectIsMutating() // [!code --]
readonly mutatingTodos = // [!code --]
  this.useIsMutating({ mutationKey: ['todos'] }).toSignal() // [!code --]
readonly mutatingTodos = injectIsMutating({ mutationKey: ['todos'] }) // [!code ++]
```

Use `toObservable(this.fetchingTodos)` if a consumer still needs an Observable.

### Inject the `QueryClient`

Use Angular dependency injection directly instead of `injectQueryClient`:

```ts
import { injectQueryClient } from '@openng/query' // [!code --]
import { inject } from '@angular/core' // [!code ++]
import { QueryClient } from '@tanstack/angular-query' // [!code ++]

private readonly queryClient = injectQueryClient() // [!code --]
private readonly queryClient = inject(QueryClient) // [!code ++]
```

### Migrate devtools

Replace the legacy devtools provider with the `withDevtools` feature from the standalone Angular
Query devtools package.

```ts
import { provideQueryClientOptions } from '@openng/query' // [!code --]
import { provideQueryDevTools } from '@openng/query-devtools' // [!code --]
import { QueryClient, provideTanStackQuery } from '@tanstack/angular-query' // [!code ++]
import { withDevtools } from '@tanstack/angular-query-devtools' // [!code ++]

const devtools = withDevtools(() => ({ initialIsOpen: true }))

providers: [
  provideQueryClientOptions({}), // [!code --]
  provideQueryDevTools({ initialIsOpen: true }), // [!code --]
  provideTanStackQuery(() => new QueryClient(), devtools), // [!code ++]
]
```

See the [Devtools guide](../devtools.md) for production entrypoints and reactive options.
