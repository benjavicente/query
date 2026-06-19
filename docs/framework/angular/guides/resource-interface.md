---
id: resource-interface
title: Resource Interface
---

Angular Query exposes every query result as an Angular Resource-compatible view through the
`resource` property:

```angular-ts
import { injectQuery } from '@tanstack/angular-query'

@Component({
  template: `
    @let user = userQuery.resource;

    @if (user.isLoading()) {
      <p>Loading...</p>
    } @else if (user.hasValue()) {
      <p>{{ user.value().name }}</p>
    }
  `,
})
export class UserProfile {
  userId = input.required<string>()

  userQuery = injectQuery(() => ({
    queryKey: ['user', this.userId()],
    queryFn: () => fetchUser(this.userId()),
  }))
}
```

Use `query.resource` when an Angular API expects a [Resource](https://angular.dev/api/core/Resource).

## Reloading a Resource

The resource interface provided by Angular Query also has a `reload` method that matches the Angular
[WritableResource `reload` method](https://angular.dev/api/core/WritableResource#reload). When
called, it starts a refetch and returns `true` only when the query is stale and not already loading.
If the query is fresh, idle, or already loading, it returns `false` and does not refetch.

## Using Resource with Signal Forms

Angular Signal Forms'
[`validateAsync`](https://angular.dev/guide/forms/signals/async-operations#custom-async-validation-with-validateasync)
accepts a Resource factory. Returning `injectQuery(...).resource` lets async validation use Angular
Query caching, request deduplication, cancellation, retries, and stale-time behavior.

The example below validates a username. The query is disabled while the field has no value, and the
factory returns `.resource`.

```ts
import { inject, signal } from '@angular/core'
import { form, validateAsync } from '@angular/forms/signals'
import { injectQuery } from '@tanstack/angular-query'

type UsernameValidation = {
  available: boolean
}

class RegistrationForm {
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
        result.available
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

Calling `reloadValidation()` on the field calls the Resource `reload()` method.
