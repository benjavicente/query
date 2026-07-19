---
id: resource-interface
title: Resource Interface
---

Angular Query exposes every query result as an Angular Resource-compatible view through the
`resource` property:

```ts
import { Component, input } from '@angular/core'
import { injectQuery } from '@tanstack/angular-query'

@Component({
  selector: 'todo-detail',
  template: '',
})
export class TodoDetail {
  id = input.required<number>()

  todo = injectQuery(() => ({
    queryKey: ['todo', this.id()],
    queryFn: () => fetchTodo(this.id()),
  }))

  todoResource = this.todo.resource
}
```

`query.resource` is useful when you want to pass a query to APIs that understand Angular's Resource
shape, or when a component already uses Resource terminology such as `status`, `value`, `error`, and
`reload`.

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
  readonly model = signal({
    username: '',
  })

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
