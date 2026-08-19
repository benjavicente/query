import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core'
import { provideTanStackQuery, QueryClient } from '@benjavicente/angular-query'
import { withDevtools } from '@benjavicente/angular-query-devtools'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideTanStackQuery(() => new QueryClient(), withDevtools()),
  ],
}
