import type { ApplicationConfig } from '@angular/core'
import { provideClientHydration, withEventReplay } from '@angular/platform-browser'
import {
  QueryClient,
  provideTanStackQuery,
} from '@tanstack/angular-query-experimental'
import { withDevtools } from '@tanstack/angular-query-devtools'
import { withHydration } from '@tanstack/angular-query-hydration/client'

export const getAppConfig = (): ApplicationConfig => {
  return {
    providers: [
      provideClientHydration(withEventReplay()),
      provideTanStackQuery(
        new QueryClient({
          defaultOptions: {
            queries: {
              staleTime: 1000 * 30,
              gcTime: 1000 * 60 * 60 * 24,
            },
          },
        }),
        withDevtools(),
        withHydration()
      ),
    ],
  }
}
