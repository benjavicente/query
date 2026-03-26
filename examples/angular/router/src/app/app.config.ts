import { provideHttpClient, withFetch } from '@angular/common/http'
import { provideRouter, withComponentInputBinding } from '@angular/router'
import {
  QueryClient,
  provideTanStackQuery,
} from '@benjavicente/angular-query-experimental'

import { withDevtools } from '@benjavicente/angular-query-devtools'
import { routes } from './app.routes'
import type { ApplicationConfig } from '@angular/core'

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideTanStackQuery(new QueryClient(), withDevtools()),
    provideRouter(routes, withComponentInputBinding()),
  ],
}
