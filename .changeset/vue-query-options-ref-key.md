---
'@tanstack/vue-query': patch
---

Fix `useQuery` rejecting `queryOptions` whose `queryKey` contains a `ref` on TypeScript versions before 7.0
