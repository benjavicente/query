# Angular mutation lifecycle timing reproduction

This example exercises the lifecycle timing described in
[TanStack Query issue #9020](https://github.com/TanStack/query/issues/9020) and
the `whenStable()` race described in
[issue #11176](https://github.com/TanStack/query/issues/11176).

## Run it

From the repository root:

```sh
pnpm --dir examples/angular/mutation-lifecycle-timing start
```

## Broken behavior: constructor and `ngOnInit`

Three mutations start automatically from the constructor, `ngOnInit`, and
`ngAfterContentInit`. While their promises are pending, all three should report
`pending`. Older adapter behavior left the constructor and `ngOnInit` mutations
looking `idle` until completion, while the `ngAfterContentInit` mutation worked.

The page records the state immediately after each lifecycle-triggered call and
also shows the live state so the difference is easy to inspect.

## Expected behavior

Every mutation should transition from `idle` to `pending` as soon as
`mutate()` starts, regardless of which Angular lifecycle phase invokes it.

## Broken behavior: `whenStable()` after `mutate()`

Click **Start mutation and await whenStable**. The mutation is fire-and-forget,
so Angular must remain unstable until it settles. A broken adapter can resolve
`whenStable()` immediately and report `idle`/no data even though the mutation
is still running.

## Expected behavior

`whenStable()` should resolve only after the mutation has settled and the
mutation result should be `success` with the returned value.
