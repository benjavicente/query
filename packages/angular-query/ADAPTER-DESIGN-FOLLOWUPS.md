# Angular adapter design follow-ups

These follow-ups are implemented and superseded by the
[adapter simplification decisions](../../ANGULAR-DECISIONS.md#adapter-simplification).

- Parallel-query field objects and explicit methods are cached per array position; both caches shrink.
- `injectExternalStore` replaces both earlier subscription helpers with one activation policy.
- Mutation-state snapshots use shallow array equality; combined query values use `Object.is`.
- Features expose an opaque public type. Their provider factory is internal and has no kind metadata.

See the [original audit and final status](ADAPTER-SIMPLIFICATION-PLAN.md) for supporting evidence.
