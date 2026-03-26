import { provideHttpClient, withFetch } from '@angular/common/http'
import {
  QueryClient,
  provideTanStackQuery,
} from '@benjavicente/angular-query-experimental'
import { withDevtools } from '@benjavicente/angular-query-devtools'
import type { ApplicationConfig } from '@angular/core'

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideTanStackQuery(new QueryClient(), withDevtools()),
  ],
}
