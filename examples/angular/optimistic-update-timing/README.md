# Angular optimistic-update timing reproduction

This is a focused reproduction for the timing problem described in
[TanStack Query issue #9735](https://github.com/TanStack/query/issues/9735).

## Run it

From the repository root:

```sh
pnpm --dir examples/angular/optimistic-update-timing start
```

Click **Save** once the page has loaded. The page records the query cache and
the Angular query signal from inside `onMutate`, followed by a microtask and an
animation frame.

## Broken behavior to check

The cache is updated optimistically, but `query.data()` can still report the
previous value during the same update turn. When the editing view is replaced
by the display view, that stale value can be visible for a render or frame.

If the adapter reproduces the issue, the first observation exposes the mismatch
as:

```text
cache="new title", signal="old title"
```

## Expected behavior on a fixed adapter

Once `onMutate` has synchronously applied the optimistic cache update, the
query signal and the rendered display should show `new title` immediately,
without a stale frame. The cache and signal values in the snapshots should
match at every phase.
