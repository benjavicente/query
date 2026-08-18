import { describe, expectTypeOf, it } from 'vitest'
import { injectInfiniteQuery, toResource } from '..'
import type { Signal } from '@angular/core'
import type { InfiniteData } from '@tanstack/query-core'

describe('injectInfiniteQuery', () => {
  describe('initialData', () => {
    it('should narrow a defined result after an isError check', () => {
      const query = injectInfiniteQuery(() => ({
        queryKey: ['infiniteQuery'],
        queryFn: ({ pageParam }) =>
          Promise.resolve('data on page ' + pageParam),
        initialData: { pages: ['initial data'], pageParams: [0] },
        initialPageParam: 0,
        getNextPageParam: () => 12,
      }))

      if (query.isError()) {
        expectTypeOf(query.error).toEqualTypeOf<Signal<Error>>()
      }

      expectTypeOf(toResource(query).value).toEqualTypeOf<
        Signal<InfiniteData<string, unknown>>
      >()

      // @ts-expect-error Resources are created explicitly with toResource.
      query.resource
    })

    it('should keep data possibly undefined when initialData is undefined', () => {
      const query = injectInfiniteQuery(() => ({
        queryKey: ['infiniteQuery'],
        queryFn: ({ pageParam }) =>
          Promise.resolve('data on page ' + pageParam),
        initialData: undefined,
        initialPageParam: 0,
        getNextPageParam: () => 12,
      }))

      expectTypeOf(query.data).toEqualTypeOf<
        Signal<undefined> | Signal<InfiniteData<string, unknown>>
      >()
    })
  })

  describe('Discriminated union return type', () => {
    it('data should be possibly undefined by default', () => {
      const query = injectInfiniteQuery(() => ({
        queryKey: ['infiniteQuery'],
        queryFn: ({ pageParam }) =>
          Promise.resolve('data on page ' + pageParam),
        initialPageParam: 0,
        getNextPageParam: () => 12,
      }))

      expectTypeOf(query.data).toEqualTypeOf<
        Signal<undefined> | Signal<InfiniteData<string, unknown>>
      >()
    })

    it('data should be defined when query is success', () => {
      const query = injectInfiniteQuery(() => ({
        queryKey: ['infiniteQuery'],
        queryFn: ({ pageParam }) =>
          Promise.resolve('data on page ' + pageParam),
        initialPageParam: 0,
        getNextPageParam: () => 12,
      }))

      if (query.isSuccess()) {
        expectTypeOf(query.data).toEqualTypeOf<
          Signal<InfiniteData<string, unknown>>
        >()
        expectTypeOf(toResource(query).value).toEqualTypeOf<
          Signal<InfiniteData<string, unknown>>
        >()
      }
    })

    it('error should be null when query is success', () => {
      const query = injectInfiniteQuery(() => ({
        queryKey: ['infiniteQuery'],
        queryFn: ({ pageParam }) =>
          Promise.resolve('data on page ' + pageParam),
        initialPageParam: 0,
        getNextPageParam: () => 12,
      }))

      if (query.isSuccess()) {
        expectTypeOf(query.error).toEqualTypeOf<Signal<null>>()
      }
    })

    it('data should be undefined when query is pending', () => {
      const query = injectInfiniteQuery(() => ({
        queryKey: ['infiniteQuery'],
        queryFn: ({ pageParam }) =>
          Promise.resolve('data on page ' + pageParam),
        initialPageParam: 0,
        getNextPageParam: () => 12,
      }))

      if (query.isPending()) {
        expectTypeOf(query.data).toEqualTypeOf<Signal<undefined>>()
      }
    })

    it('error should be defined when query is error', () => {
      const query = injectInfiniteQuery(() => ({
        queryKey: ['infiniteQuery'],
        queryFn: ({ pageParam }) =>
          Promise.resolve('data on page ' + pageParam),
        initialPageParam: 0,
        getNextPageParam: () => 12,
      }))

      if (query.isError()) {
        expectTypeOf(query.error).toEqualTypeOf<Signal<Error>>()
      }
    })
  })

  it('should provide the correct types to the select function', () => {
    const query = injectInfiniteQuery(() => ({
      queryKey: ['infiniteQuery'],
      queryFn: ({ pageParam }) => Promise.resolve('data on page ' + pageParam),
      initialPageParam: 0,
      getNextPageParam: () => 12,
      select: (data) => {
        expectTypeOf(data).toEqualTypeOf<InfiniteData<string, number>>()
        return data
      },
    }))

    expectTypeOf(query.data).toEqualTypeOf<
      Signal<undefined> | Signal<InfiniteData<string, number>>
    >()
  })
})
