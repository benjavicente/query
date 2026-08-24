import { describe, expectTypeOf, it } from 'vitest'
import {
  QueryClient,
  provideTanStackQuery,
  withHydrationKey,
  withNoQueryHydration,
} from '..'
import type { QueryFeature } from '..'

describe('provideTanStackQuery', () => {
  it('accepts built-in opaque query features', () => {
    expectTypeOf(withHydrationKey('cache')).toEqualTypeOf<QueryFeature>()
    expectTypeOf(withNoQueryHydration()).toEqualTypeOf<QueryFeature>()

    provideTanStackQuery(
      () => new QueryClient(),
      withHydrationKey('cache'),
      withNoQueryHydration(),
    )
  })

  it('rejects structurally fabricated features', () => {
    expectTypeOf(withHydrationKey('cache')).toEqualTypeOf<QueryFeature>()

    provideTanStackQuery(
      () => new QueryClient(),
      // @ts-expect-error QueryFeature values can only be created by package features
      { ɵkind: 'Hydration', ɵproviders: {} },
    )
  })
})
