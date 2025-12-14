import { describe, expectTypeOf, test } from 'vitest'
import { sleep } from '@tanstack/query-test-utils'
import { injectMutation } from '..'

describe('Discriminated union return type', () => {
  test('data should be possibly undefined by default', () => {
    const mutation = injectMutation(() => ({
      mutationFn: () => sleep(0).then(() => 'string'),
    }))

    expectTypeOf(mutation.data).toEqualTypeOf<string | undefined>()
  })

  test('data should be defined when mutation is success', () => {
    const mutation = injectMutation(() => ({
      mutationFn: () => sleep(0).then(() => 'string'),
    }))

    if (mutation.isSuccess) {
      expectTypeOf(mutation.data).toEqualTypeOf<string>()
    }
  })

  test('error should be null when mutation is success', () => {
    const mutation = injectMutation(() => ({
      mutationFn: () => sleep(0).then(() => 'string'),
    }))

    if (mutation.isSuccess) {
      expectTypeOf(mutation.error).toEqualTypeOf<null>()
    }
  })

  test('data should be undefined when mutation is pending', () => {
    const mutation = injectMutation(() => ({
      mutationFn: () => sleep(0).then(() => 'string'),
    }))

    if (mutation.isPending) {
      expectTypeOf(mutation.data).toEqualTypeOf<undefined>()
    }
  })

  test('error should be defined when mutation is error', () => {
    const mutation = injectMutation(() => ({
      mutationFn: () => sleep(0).then(() => 'string'),
    }))

    if (mutation.isError) {
      expectTypeOf(mutation.error).toEqualTypeOf<Error>()
    }
  })

  test('should narrow variables', () => {
    const mutation = injectMutation(() => ({
      mutationFn: (_variables: string) => sleep(0).then(() => 'string'),
    }))

    if (mutation.isIdle) {
      expectTypeOf(mutation.variables).toEqualTypeOf<undefined>()
    }
    if (mutation.isPending) {
      expectTypeOf(mutation.variables).toEqualTypeOf<string>()
    }
    if (mutation.isSuccess) {
      expectTypeOf(mutation.variables).toEqualTypeOf<string>()
    }
    expectTypeOf(mutation.variables).toEqualTypeOf<string | undefined>()
  })
})
