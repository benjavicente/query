---
id: resource-api
title: Resource API
---

Angular Query exposes every query result as an Angular Resource-compatible view through the
`resource` property:

```ts
import { injectQuery } from '@tanstack/angular-query'

export class TodoDetail {
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

## Resource states

The Resource view is derived from the current query observer result:

| Resource state | Query state |
| -------------- | ----------- |
| `idle` | The query is pending but is not fetching, usually because it is disabled. |
| `loading` | The query is fetching and has no data yet. |
| `reloading` | The query is fetching while previous data is still available. |
| `resolved` | The query has completed successfully. |
| `error` | The query is in an error state. |

`resource.value()` returns the current query data. If the Resource is in the `error` state, it throws
the normalized query error, matching Angular Resource behavior.

`resource.reload()` returns a boolean. It only refetches when the query is currently stale. It returns
`false` when the query is idle, already loading, or the cached data is still fresh according to the
query's `staleTime`.

## Using Resource with Signal Forms

Angular Signal Forms' `validateAsync` accepts a Resource factory. This lets you use Angular Query for
async validation while keeping caching, request deduplication, cancellation, retries, and stale-time
behavior in one place.

The example below validates a coupon code. The validator:

- returns `undefined` params for empty values so validation can be skipped
- creates a disabled query while params are unavailable
- returns `query.resource` from the `factory`
- keeps the form-specific success and error mapping inside `onSuccess` and `onError`

```ts
import { computed, inject, signal } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { applyWhenValue, form, validateAsync } from '@angular/forms/signals'
import { injectQuery } from '@tanstack/angular-query'

type CouponValidation =
  | { valid: false; message: string }
  | { valid: true; discountPercent: number }

class CheckoutForm {
  private readonly couponApi = inject(CouponApi)

  readonly discount = signal(0)

  readonly model = signal({
    coupon: {
      code: '',
    },
  })

  readonly checkoutForm = form(this.model, (schema) => {
    applyWhenValue(
      schema.coupon.code,
      (value) => !!value,
      (path) =>
        validateAsync(path, {
          debounce: 300,
          params: ({ value }) => {
            const code = value().trim()
            return code || undefined
          },
          factory: (codeParam) =>
            injectQuery(() => {
              let code: string | undefined

              try {
                code = T()
              } catch {
                // Angular Resource params can be temporarily unavailable while
                // debounced validation is settling. Keep the query disabled.
                code = undefined
              }

              return {
                queryKey: ['coupon-validation', code],
                enabled: !!code,
                queryFn: (): Promise<CouponValidation> =>
                  firstValueFrom(this.couponApi.validateCoupon(code!)),
              }
            }).resource,
          onSuccess: (response) => {
            if (!response.valid) {
              this.discount.set(0)
              return {
                kind: 'couponInvalid',
                message: response.message || 'Invalid coupon code',
              }
            }

            this.discount.set(response.discountPercent)
            return null
          },
          onError: () => {
            this.discount.set(0)
            return {
              kind: 'couponError',
              message: 'Could not validate coupon code',
            }
          },
        }),
    )
  })

  readonly discountAmount = computed(() => {
    const code = this.model().coupon.code
    const discount = this.discount()

    if (!code || discount <= 0) {
      return 0
    }

    return discount
  })
}
```

`factory` is called once by Signal Forms and receives params as a signal. Because `injectQuery`
reactively tracks signal reads inside its options function, reading `codeParam()` inside
`injectQuery(() => ({ ... }))` updates the query key and enabled state as the field changes.

Calling `reloadValidation()` on the field calls the Resource `reload()` method. With Angular Query's
Resource view, that will refetch only when the cached query data is stale.
