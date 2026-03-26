import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core'
import {
  provideTanStackQuery,
  QueryClient,
} from '@benjavicente/angular-query-experimental'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideTanStackQuery(new QueryClient()),
  ],
}
