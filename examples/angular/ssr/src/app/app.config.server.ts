import { mergeApplicationConfig } from '@angular/core'
import { provideServerRendering, withRoutes } from '@angular/ssr'
import { getAppConfig } from './app.config'
import { serverRoutes } from './app.routes.server'
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental'
import { provideServerQueryHydration } from '@tanstack/angular-query-hydration/server'

export const getServerConfig = () => mergeApplicationConfig(getAppConfig(), {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 1000 * 60 * 60 * 24, staleTime: 1000 * 30 } } })),
    provideServerQueryHydration()
  ],
})
