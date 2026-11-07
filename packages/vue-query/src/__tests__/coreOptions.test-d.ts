import { assertType, describe, expectTypeOf, it } from 'vitest'
import { computed, ref } from 'vue-demi'
import {
  infiniteQueryOptions as coreInfiniteQueryOptions,
  mutationOptions as coreMutationOptions,
  queryOptions as coreQueryOptions,
  skipToken,
} from '@tanstack/query-core'
import { createKey } from '@tanstack/query-test-utils'
import { QueryClient } from '../queryClient'
import { useInfiniteQuery } from '../useInfiniteQuery'
import { useMutation } from '../useMutation'
import { useQueries } from '../useQueries'
import { useQuery } from '../useQuery'
import type {
  CoreQueryOptions,
  InfiniteData,
  QueryKey,
} from '@tanstack/query-core'
import type { UseInfiniteQueryOptions } from '../useInfiniteQuery'
import type { UseQueryOptions } from '../queryOptions'
import type { MaybeRefOrGetter } from '../types'

const queryFn = () => Promise.resolve([1, 2])
declare const todoId: number

describe('core options', () => {
  describe('useQuery', () => {
    it('should accept core options directly', () => {
      const options = coreQueryOptions({ queryKey: createKey(), queryFn })

      expectTypeOf(useQuery(options).data.value).toEqualTypeOf<
        Array<number> | undefined
      >()
    })

    it('should accept core options with a tuple key', () => {
      const options = coreQueryOptions({
        queryKey: ['todo', 1] as const,
        queryFn: ({ queryKey }) => [queryKey[1]],
      })

      expectTypeOf(useQuery(options).data.value).toEqualTypeOf<
        Array<1> | undefined
      >()
    })

    it('should accept core options with query callbacks', () => {
      const options = coreQueryOptions({
        queryKey: ['todo', todoId] as const,
        queryFn,
        enabled: (query) => query.queryKey[1] === todoId,
        staleTime: (query) => (query.state.data ? 1000 : 0),
        refetchInterval: (query) => (query.state.data ? 1000 : false),
      })

      expectTypeOf(useQuery(options).data.value).toEqualTypeOf<
        Array<number> | undefined
      >()
    })

    it('should infer data from select', () => {
      const options = coreQueryOptions({
        queryKey: createKey(),
        queryFn,
        select: (data) => data.length,
      })

      expectTypeOf(useQuery(options).data.value).toEqualTypeOf<
        number | undefined
      >()
    })

    it('should narrow data when initialData is defined', () => {
      const options = coreQueryOptions({
        queryKey: createKey(),
        queryFn,
        initialData: [1],
      })

      expectTypeOf(useQuery(options).data.value).toEqualTypeOf<Array<number>>()
    })

    it('should accept skipToken', () => {
      const options = coreQueryOptions({
        queryKey: createKey(),
        queryFn: Math.random() > 0.5 ? queryFn : skipToken,
      })

      expectTypeOf(useQuery(options).data.value).toEqualTypeOf<
        Array<number> | undefined
      >()
    })

    it('should accept a getter, a computed and a ref of core options', () => {
      const options = coreQueryOptions({
        queryKey: ['todo', todoId] as const,
        queryFn,
        enabled: (query) => query.queryKey[1] === todoId,
      })

      expectTypeOf(useQuery(() => options).data.value).toEqualTypeOf<
        Array<number> | undefined
      >()
      expectTypeOf(useQuery(computed(() => options)).data.value).toEqualTypeOf<
        Array<number> | undefined
      >()
      expectTypeOf(useQuery(ref(options)).data.value).toEqualTypeOf<
        Array<number> | undefined
      >()
    })

    it('should accept reactive overrides of core options', () => {
      const options = coreQueryOptions({
        queryKey: ['todo', todoId] as const,
        queryFn,
        enabled: (query) => query.queryKey[1] === todoId,
      })

      const results = [
        useQuery({ ...options, enabled: ref(true) }),
        useQuery({ ...options, enabled: computed(() => true) }),
        useQuery({ ...options, enabled: () => true }),
        useQuery({ ...options, staleTime: ref(1000) }),
        useQuery({ ...options, shallow: true }),
      ]

      expectTypeOf(results[0]!.data.value).toEqualTypeOf<
        Array<number> | undefined
      >()
    })

    it('should accept generic core options', () => {
      function useWrapper<TData>(options: CoreQueryOptions<TData>) {
        return useQuery(options)
      }

      expectTypeOf(useWrapper).returns.toHaveProperty('data')
    })

    it('should reject invalid overrides of core options', () => {
      const options = coreQueryOptions({ queryKey: createKey(), queryFn })

      assertType(
        // @ts-expect-error enabled is not a string
        useQuery({ ...options, enabled: 'yes' }),
      )
      assertType(
        // @ts-expect-error select receives the query data
        useQuery({ ...options, select: (data: string) => data }),
      )
      assertType(
        // @ts-expect-error queryFn does not match the tagged key
        useQuery({ ...options, queryFn: () => Promise.resolve('data') }),
      )
    })
  })

  describe('useQueries', () => {
    it('should infer core options', () => {
      const first = coreQueryOptions({ queryKey: createKey(), queryFn })
      const second = coreQueryOptions({
        queryKey: ['todo', todoId] as const,
        queryFn: () => Promise.resolve('data'),
        enabled: (query) => query.queryKey[1] === todoId,
      })

      const queries = useQueries({ queries: [first, second] })

      expectTypeOf(queries.value[0].data).toEqualTypeOf<
        Array<number> | undefined
      >()
      expectTypeOf(queries.value[1].data).toEqualTypeOf<string | undefined>()
    })
  })

  describe('useInfiniteQuery', () => {
    const page = ({ pageParam }: { pageParam: number }) =>
      Promise.resolve([pageParam])
    const pagination = {
      initialPageParam: 0,
      getNextPageParam: () => 1,
    }

    it('should accept core options directly and through a getter', () => {
      const options = coreInfiniteQueryOptions({
        queryKey: createKey(),
        queryFn: page,
        ...pagination,
        enabled: (query) => !query.state.data,
      })

      expectTypeOf(useInfiniteQuery(options).data.value).toEqualTypeOf<
        InfiniteData<Array<number>> | undefined
      >()
      expectTypeOf(useInfiniteQuery(() => options).data.value).toEqualTypeOf<
        InfiniteData<Array<number>> | undefined
      >()
    })

    it('should narrow data when initialData is defined', () => {
      const options = coreInfiniteQueryOptions({
        queryKey: createKey(),
        queryFn: page,
        ...pagination,
        initialData: { pages: [[1]], pageParams: [0] },
      })

      expectTypeOf(useInfiniteQuery(options).data.value).toEqualTypeOf<
        InfiniteData<Array<number>>
      >()
    })
  })

  describe('useMutation', () => {
    it('should accept core options directly and through a getter', () => {
      const options = coreMutationOptions({
        mutationKey: createKey(),
        mutationFn: (value: number) => Promise.resolve(String(value)),
      })

      expectTypeOf(useMutation(options).data.value).toEqualTypeOf<
        string | undefined
      >()
      expectTypeOf(useMutation(() => options).data.value).toEqualTypeOf<
        string | undefined
      >()
      useMutation(options).mutate(1)
      // @ts-expect-error variables are numbers
      useMutation(options).mutate('1')
    })

    it('should keep the lifecycle callback types', () => {
      const options = coreMutationOptions({
        mutationFn: (value: number) => Promise.resolve(String(value)),
        onMutate: (value) => ({ value }),
        onSuccess: (data, variables, onMutateResult) => {
          expectTypeOf(data).toEqualTypeOf<string>()
          expectTypeOf(variables).toEqualTypeOf<number>()
          expectTypeOf(onMutateResult).toEqualTypeOf<{ value: number }>()
        },
      })

      useMutation(options).mutate(1)
    })

    it('should accept reactive overrides of core options', () => {
      const options = coreMutationOptions({
        mutationFn: (value: number) => Promise.resolve(String(value)),
      })

      expectTypeOf(
        useMutation({ ...options, retry: ref(2) }).data.value,
      ).toEqualTypeOf<string | undefined>()
      expectTypeOf(
        useMutation({ ...options, shallow: true }).data.value,
      ).toEqualTypeOf<string | undefined>()
    })
  })

  describe('queryClient', () => {
    it('should accept core options', () => {
      const queryClient = new QueryClient()
      const query = coreQueryOptions({ queryKey: createKey(), queryFn })

      assertType<Promise<Array<number>>>(queryClient.query(query))
      assertType<Array<number> | undefined>(
        queryClient.getQueryData(query.queryKey),
      )
    })
  })

  describe('existing Vue options', () => {
    const id = ref(1)

    it('should keep unwrapping ref keys in getters', () => {
      useQuery(() => ({
        queryKey: ['todo', id] as const,
        queryFn: ({ queryKey }) => {
          expectTypeOf(queryKey[1]).toEqualTypeOf<number>()
          return 1
        },
        enabled: (query) => {
          expectTypeOf(query.queryKey[1]).toEqualTypeOf<number>()
          return true
        },
      }))
    })

    it('should keep unwrapping ref keys in infinite getters', () => {
      useInfiniteQuery(() => ({
        queryKey: ['todo', id] as const,
        queryFn: ({ queryKey }) => {
          expectTypeOf(queryKey[1]).toEqualTypeOf<number>()
          return 1
        },
        initialPageParam: 0,
        getNextPageParam: () => 1,
      }))
    })

    it('should keep the Vue options as the last overload', () => {
      expectTypeOf<Parameters<typeof useQuery>[0]>().toEqualTypeOf<
        MaybeRefOrGetter<
          UseQueryOptions<unknown, unknown, unknown, unknown, QueryKey>
        >
      >()
      expectTypeOf<Parameters<typeof useInfiniteQuery>[0]>().toEqualTypeOf<
        MaybeRefOrGetter<
          UseInfiniteQueryOptions<unknown, unknown, unknown, QueryKey, unknown>
        >
      >()
    })
  })
})
