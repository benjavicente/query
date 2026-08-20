import { bootstrapApplication } from '@angular/platform-browser'
import { provideTanStackQuery, QueryClient } from '@benjavicente/angular-query'
import { AppComponent } from './app/app.component'
import type { ApplicationConfig } from '@angular/core'

const appConfig: ApplicationConfig = {
  providers: [provideTanStackQuery(() => new QueryClient())],
}

bootstrapApplication(AppComponent, appConfig).catch((error) =>
  console.error(error),
)
