import { bootstrapApplication } from '@angular/platform-browser'
import { getAppConfig } from './app/app.config'
import { SsrExampleComponent } from './app/app.component'

bootstrapApplication(SsrExampleComponent, getAppConfig()).catch((err) =>
  console.error(err),
)
