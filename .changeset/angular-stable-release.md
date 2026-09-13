---
'@tanstack/angular-query': minor
'@tanstack/angular-query-devtools': minor
'@tanstack/angular-query-persist-client': minor
---

Introduce the stable Angular Query package for Angular 20.1 and later, replacing `@tanstack/angular-query-experimental`. Move devtools into `@tanstack/angular-query-devtools` and update the persistence integration to use the stable adapter.

The stable API uses a factory with `provideTanStackQuery`, adds SSR hydration controls and Resource interoperability, and manages external-store subscriptions through Angular effects. Deprecated experimental entry points and provider aliases are removed. See the Angular migration guide for updated imports, providers, and persistence configuration.
