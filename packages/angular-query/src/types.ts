/* istanbul ignore file */

import type {
  DefaultError,
  DefinedInfiniteQueryObserverResult,
  DefinedQueryObserverResult,
  InfiniteQueryObserverOptions,
  InfiniteQueryObserverResult,
  MutateFunction,
  MutationObserverOptions,
  MutationObserverResult,
  OmitKeyof,
  Override,
  QueryKey,
  QueryObserverOptions,
  QueryObserverResult,
} from '@tanstack/query-core'
import type { Signal } from '@angular/core'
import type { MapToSignals, MethodKeys } from './utils/signal-proxy'

type SignalFunction<T extends () => any> = T & Signal<ReturnType<T>>

export type CreateQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = OmitKeyof<
  QueryObserverOptions<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>,
  'notifyOnChangeProps' | 'suspense'
>

type CreateStatusBasedQueryResult<
  TStatus extends QueryObserverResult['status'],
  TData = unknown,
  TError = DefaultError,
> = Extract<QueryObserverResult<TData, TError>, { status: TStatus }>

type CreateStatusBasedDefinedQueryResult<
  TStatus extends DefinedQueryObserverResult['status'],
  TData = unknown,
  TError = DefaultError,
> = Extract<DefinedQueryObserverResult<TData, TError>, { status: TStatus }>

type CreateStatusBasedInfiniteQueryResult<
  TStatus extends InfiniteQueryObserverResult['status'],
  TData = unknown,
  TError = DefaultError,
> = Extract<InfiniteQueryObserverResult<TData, TError>, { status: TStatus }>

type CreateStatusBasedDefinedInfiniteQueryResult<
  TStatus extends DefinedInfiniteQueryObserverResult['status'],
  TData = unknown,
  TError = DefaultError,
> = Extract<
  DefinedInfiniteQueryObserverResult<TData, TError>,
  { status: TStatus }
>

export interface BaseQueryNarrowing<TData = unknown, TError = DefaultError> {
  isSuccess: SignalFunction<
    (
      this: CreateBaseQueryResult<TData, TError>,
    ) => this is CreateBaseQueryResult<
      TData,
      TError,
      CreateStatusBasedQueryResult<'success', TData, TError>
    >
  >
  isError: SignalFunction<
    (
      this: CreateBaseQueryResult<TData, TError>,
    ) => this is CreateBaseQueryResult<
      TData,
      TError,
      CreateStatusBasedQueryResult<'error', TData, TError>
    >
  >
  isPending: SignalFunction<
    (
      this: CreateBaseQueryResult<TData, TError>,
    ) => this is CreateBaseQueryResult<
      TData,
      TError,
      CreateStatusBasedQueryResult<'pending', TData, TError>
    >
  >
}

export interface DefinedQueryNarrowing<TData = unknown, TError = DefaultError> {
  isSuccess: SignalFunction<
    (
      this: DefinedCreateQueryResult<TData, TError>,
    ) => this is DefinedCreateQueryResult<
      TData,
      TError,
      CreateStatusBasedDefinedQueryResult<'success', TData, TError>
    >
  >
  isError: SignalFunction<
    (
      this: DefinedCreateQueryResult<TData, TError>,
    ) => this is DefinedCreateQueryResult<
      TData,
      TError,
      CreateStatusBasedDefinedQueryResult<'error', TData, TError>
    >
  >
  isPending: SignalFunction<
    (this: DefinedCreateQueryResult<TData, TError>) => this is never
  >
}

export interface BaseInfiniteQueryNarrowing<
  TData = unknown,
  TError = DefaultError,
> {
  isSuccess: SignalFunction<
    (
      this: CreateInfiniteQueryResult<TData, TError>,
    ) => this is CreateInfiniteQueryResult<
      TData,
      TError,
      CreateStatusBasedInfiniteQueryResult<'success', TData, TError>
    >
  >
  isError: SignalFunction<
    (
      this: CreateInfiniteQueryResult<TData, TError>,
    ) => this is CreateInfiniteQueryResult<
      TData,
      TError,
      CreateStatusBasedInfiniteQueryResult<'error', TData, TError>
    >
  >
  isPending: SignalFunction<
    (
      this: CreateInfiniteQueryResult<TData, TError>,
    ) => this is CreateInfiniteQueryResult<
      TData,
      TError,
      CreateStatusBasedInfiniteQueryResult<'pending', TData, TError>
    >
  >
}

export interface DefinedInfiniteQueryNarrowing<
  TData = unknown,
  TError = DefaultError,
> {
  isSuccess: SignalFunction<
    (
      this: DefinedCreateInfiniteQueryResult<TData, TError>,
    ) => this is DefinedCreateInfiniteQueryResult<
      TData,
      TError,
      CreateStatusBasedDefinedInfiniteQueryResult<'success', TData, TError>
    >
  >
  isError: SignalFunction<
    (
      this: DefinedCreateInfiniteQueryResult<TData, TError>,
    ) => this is DefinedCreateInfiniteQueryResult<
      TData,
      TError,
      CreateStatusBasedDefinedInfiniteQueryResult<'error', TData, TError>
    >
  >
  isPending: SignalFunction<
    (this: DefinedCreateInfiniteQueryResult<TData, TError>) => this is never
  >
}

export interface CreateInfiniteQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends OmitKeyof<
  InfiniteQueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryKey,
    TPageParam
  >,
  'notifyOnChangeProps' | 'suspense'
> {}

export type CreateBaseQueryResult<
  TData = unknown,
  TError = DefaultError,
  TState extends QueryObserverResult<TData, TError> = QueryObserverResult<
    TData,
    TError
  >,
> = BaseQueryNarrowing<TData, TError> &
  MapToSignals<
    OmitKeyof<TState, keyof BaseQueryNarrowing, 'safely'>,
    MethodKeys<OmitKeyof<TState, keyof BaseQueryNarrowing, 'safely'>>
  >

export type CreateQueryResult<
  TData = unknown,
  TError = DefaultError,
> = CreateBaseQueryResult<TData, TError>

export type DefinedCreateQueryResult<
  TData = unknown,
  TError = DefaultError,
  TState extends DefinedQueryObserverResult<TData, TError> =
    DefinedQueryObserverResult<TData, TError>,
> = DefinedQueryNarrowing<TData, TError> &
  MapToSignals<
    OmitKeyof<TState, keyof DefinedQueryNarrowing, 'safely'>,
    MethodKeys<OmitKeyof<TState, keyof DefinedQueryNarrowing, 'safely'>>
  >

export type CreateInfiniteQueryResult<
  TData = unknown,
  TError = DefaultError,
  TState extends InfiniteQueryObserverResult<TData, TError> =
    InfiniteQueryObserverResult<TData, TError>,
> = BaseInfiniteQueryNarrowing<TData, TError> &
  MapToSignals<TState, MethodKeys<TState>>

export type DefinedCreateInfiniteQueryResult<
  TData = unknown,
  TError = DefaultError,
  TDefinedInfiniteQueryObserver extends DefinedInfiniteQueryObserverResult<
    TData,
    TError
  > = DefinedInfiniteQueryObserverResult<TData, TError>,
> = DefinedInfiniteQueryNarrowing<TData, TError> &
  MapToSignals<
    TDefinedInfiniteQueryObserver,
    MethodKeys<TDefinedInfiniteQueryObserver>
  >

export interface CreateMutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
> extends OmitKeyof<
  MutationObserverOptions<TData, TError, TVariables, TOnMutateResult>,
  '_defaulted'
> {}

export type CreateMutateFunction<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
> = (
  ...args: Parameters<
    MutateFunction<TData, TError, TVariables, TOnMutateResult>
  >
) => void

export type CreateMutateAsyncFunction<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
> = MutateFunction<TData, TError, TVariables, TOnMutateResult>

export type CreateBaseMutationResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TOnMutateResult = unknown,
> = Override<
  MutationObserverResult<TData, TError, TVariables, TOnMutateResult>,
  { mutate: CreateMutateFunction<TData, TError, TVariables, TOnMutateResult> }
> & {
  mutateAsync: CreateMutateAsyncFunction<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  >
}

type CreateStatusBasedMutationResult<
  TStatus extends CreateBaseMutationResult['status'],
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TOnMutateResult = unknown,
> = Extract<
  CreateBaseMutationResult<TData, TError, TVariables, TOnMutateResult>,
  { status: TStatus }
>

export interface BaseMutationNarrowing<
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TOnMutateResult = unknown,
> {
  isSuccess: SignalFunction<
    (
      this: CreateMutationResult<TData, TError, TVariables, TOnMutateResult>,
    ) => this is CreateMutationResult<
      TData,
      TError,
      TVariables,
      TOnMutateResult,
      CreateStatusBasedMutationResult<
        'success',
        TData,
        TError,
        TVariables,
        TOnMutateResult
      >
    >
  >
  isError: SignalFunction<
    (
      this: CreateMutationResult<TData, TError, TVariables, TOnMutateResult>,
    ) => this is CreateMutationResult<
      TData,
      TError,
      TVariables,
      TOnMutateResult,
      CreateStatusBasedMutationResult<
        'error',
        TData,
        TError,
        TVariables,
        TOnMutateResult
      >
    >
  >
  isPending: SignalFunction<
    (
      this: CreateMutationResult<TData, TError, TVariables, TOnMutateResult>,
    ) => this is CreateMutationResult<
      TData,
      TError,
      TVariables,
      TOnMutateResult,
      CreateStatusBasedMutationResult<
        'pending',
        TData,
        TError,
        TVariables,
        TOnMutateResult
      >
    >
  >
  isIdle: SignalFunction<
    (
      this: CreateMutationResult<TData, TError, TVariables, TOnMutateResult>,
    ) => this is CreateMutationResult<
      TData,
      TError,
      TVariables,
      TOnMutateResult,
      CreateStatusBasedMutationResult<
        'idle',
        TData,
        TError,
        TVariables,
        TOnMutateResult
      >
    >
  >
}

export type CreateMutationResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TOnMutateResult = unknown,
  TState = CreateStatusBasedMutationResult<
    CreateBaseMutationResult['status'],
    TData,
    TError,
    TVariables,
    TOnMutateResult
  >,
> = BaseMutationNarrowing<TData, TError, TVariables, TOnMutateResult> &
  MapToSignals<
    OmitKeyof<TState, keyof BaseMutationNarrowing, 'safely'>,
    MethodKeys<OmitKeyof<TState, keyof BaseMutationNarrowing, 'safely'>>
  >
