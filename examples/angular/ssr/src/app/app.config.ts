import { provideHttpClient, withFetch } from '@angular/common/http'
import type { ApplicationConfig } from '@angular/core'
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser'
import { provideTanStackQuery } from '@benjavicente/angular-query'
import { withDevtools } from '@benjavicente/angular-query-devtools'
import { createQueryClient } from './query-client'

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),
    provideTanStackQuery(createQueryClient, withDevtools()),
  ],
}
