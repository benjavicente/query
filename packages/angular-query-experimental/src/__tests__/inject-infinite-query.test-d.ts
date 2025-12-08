import { describe, expectTypeOf, test } from 'vitest'
import { injectInfiniteQuery } from '..'
import type { InfiniteData } from '@tanstack/query-core'

describe('injectInfiniteQuery', () => {
  test('should narrow type with isSuccess, isError, isPending', () => {
    const query = injectInfiniteQuery(() => ({
      queryKey: ['infiniteQuery'],
      queryFn: () => Promise.resolve('data'),
      initialPageParam: 1,
      getNextPageParam: () => 12,
    }))

    if (query.isSuccess()) {
      expectTypeOf(query.error()).toEqualTypeOf<null>()
      expectTypeOf(query.data()).toEqualTypeOf<InfiniteData<string, unknown>>()
    } else if (query.isError()) {
      expectTypeOf(query.error()).toEqualTypeOf<Error>()
    } else if (query.isPending()) {
      expectTypeOf(query.data()).toEqualTypeOf<undefined>()
      expectTypeOf(query.error()).toEqualTypeOf<null>()
    }
  })

  test('should narrow type with status', () => {
    const query = injectInfiniteQuery(() => ({
      queryKey: ['infiniteQuery'],
      queryFn: () => Promise.resolve('data'),
      initialPageParam: 1,
      getNextPageParam: () => 12,
    }))

    if (query.status() === 'success') {
      expectTypeOf(query.data()).toEqualTypeOf<InfiniteData<string, unknown>>()
      expectTypeOf(query.error()).toEqualTypeOf<null>()
    } else if (query.status() === 'error') {
      expectTypeOf(query.error()).toEqualTypeOf<Error>()
    } else if (query.status() === 'pending') {
      expectTypeOf(query.data()).toEqualTypeOf<undefined>()
      expectTypeOf(query.error()).toEqualTypeOf<null>()
    }
  })
})
