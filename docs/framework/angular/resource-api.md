---
id: resource-api
title: Resource API
---

Angular Query exposes every query result as an Angular
[`Resource`](https://angular.dev/api/core/Resource)-compatible view through its `resource`
property. The query remains responsible for fetching and caching the server state while Angular
APIs can consume the familiar Resource shape.

```ts
import { Component, input } from '@angular/core'
import { injectQuery } from '@tanstack/angular-query'

@Component({
  selector: 'todo-detail',
  template: `
    @if (todo.hasValue()) {
      <h1>{{ todo.value().title }}</h1>
    }
  `,
})
export class TodoDetail {
  readonly id = input.required<number>()

  readonly todoQuery = injectQuery(() => ({
    queryKey: ['todo', this.id()],
    queryFn: () => fetchTodo(this.id()),
  }))

  readonly todo = this.todoQuery.resource
}
```

The Resource view exposes these fields:

| Field       | Description                                                           |
| ----------- | --------------------------------------------------------------------- |
| `value`     | The current query data                                                |
| `status`    | The query state as an Angular `ResourceStatus`                        |
| `error`     | The current error, normalized to `Error`                              |
| `isLoading` | Whether the query is loading or reloading                             |
| `hasValue`  | Whether a value is available                                          |
| `snapshot`  | The current Resource state as one signal                              |
| `reload`    | Refetches when the query is stale and returns whether a fetch started |

Use the query's field signals and methods for normal application code. Use `query.resource` when an
Angular API expects a Resource or when Resource terminology makes an integration clearer. Call
`query.refetch()` instead of `resource.reload()` when you need an unconditional refetch.

## Using Resource with Signal Forms

> Signal Forms integration requires Angular 21 or newer.

Angular Signal Forms'
[`validateAsync`](https://angular.dev/guide/forms/signals/async-operations#custom-async-validation-with-validateasync)
accepts a Resource factory. Returning `injectQuery(...).resource` lets async validation use Angular
Query caching, request deduplication, cancellation, retries, and stale-time behavior.

The example below validates a username. The query is disabled while the field has no value, and the
factory returns `.resource`.

```ts
import { Component, inject, signal } from '@angular/core'
import { form, validateAsync } from '@angular/forms/signals'
import { injectQuery } from '@tanstack/angular-query'

type UsernameValidation = {
  available: boolean
}

@Component({
  selector: 'registration-form',
  template: '',
})
export class RegistrationForm {
  private readonly users = inject(UserService)
  readonly model = signal({ username: '' })

  readonly registrationForm = form(this.model, (path) => {
    validateAsync(path.username, {
      debounce: 300,
      params: ({ value }) => value().trim() || undefined,
      factory: (username) =>
        injectQuery(() => ({
          queryKey: ['username-availability', username()],
          enabled: !!username(),
          queryFn: (): Promise<UsernameValidation> =>
            this.users.checkUsername(username()!),
        })).resource,
      onSuccess: (result) =>
        result?.available
          ? null
          : {
              kind: 'usernameTaken',
              message: 'Username is already taken',
            },
      onError: () => ({
        kind: 'usernameUnavailable',
        message: 'Could not check username availability',
      }),
    })
  })
}
```

Calling `reloadValidation()` on the field refetches the query only when its cached data is stale.

## Comparison

Choosing between Angular's built-in
[`resource`](https://angular.dev/guide/signals/resource) and TanStack Query depends on whether the
operation is isolated async state or server state shared across the application.

This table focuses on built-in behavior and may not capture every custom implementation. Review
both APIs for the needs of your application.

Feature/Capability Key:

- ✅ 1st-class, built-in, and ready to use with no added configuration or code
- 🟡 Partial support
- 🟠 Supported through an additional package
- 🔶 Possible, but requires custom application code
- 🛑 Not built in

|                                         | Angular `resource`                             | TanStack Query                                        |
| --------------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| Reactive parameters and signal state    | ✅                                             | ✅                                                    |
| Request cancellation                    | ✅                                             | ✅                                                    |
| Angular Resource interface              | ✅                                             | ✅ Through `query.resource`                           |
| Shared cache by data identity           | 🛑                                             | ✅ Query keys identify cached data                    |
| Request deduplication across components | 🛑                                             | ✅ For queries with the same key                      |
| Stale and garbage-collection timing     | 🔶                                             | ✅ `staleTime` and `gcTime`                           |
| Cache invalidation and updates          | 🔶                                             | ✅ `invalidateQueries` and `setQueryData`             |
| Retries and background refetching       | 🔶                                             | ✅ Including focus and reconnect refetching           |
| Mutations and optimistic updates        | 🔶                                             | ✅ `injectMutation` and QueryClient cache updates     |
| SSR                                     | ✅ A resource can transfer its value with `id` | ✅ The complete query cache is hydrated automatically |
| Persistence                             | 🔶                                             | 🟠 Through the persistence package                    |

Angular `resource` is a good fit for a self-contained asynchronous task. It retains the value of
its own instance and can transfer that value during SSR, but it does not provide a shared,
query-keyed cache or coordinate invalidation and mutations across the application. Use TanStack
Query for server data that is reused, cached, invalidated, mutated, retried, or persisted.
