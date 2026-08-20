import { Component, effect } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import {
  QueryClient,
  injectMutation,
  provideTanStackQuery,
} from '@benjavicente/angular-query'
import type { AfterContentInit, OnInit } from '@angular/core'

@Component({
  selector: 'app-on-init',
  templateUrl: 'main.html',
})
export class OnInitComponent implements OnInit {
  readonly name = 'OnInit'
  readonly mutation = injectMutation(() => ({
    mutationFn: () => new Promise((resolve) => setTimeout(resolve, 5_000)),
  }))

  ngOnInit(): void {
    this.mutation.mutate()
  }
}

@Component({
  selector: 'app-constructor',
  templateUrl: 'main.html',
})
export class ConstructorComponent {
  readonly name = 'Constructor'
  readonly mutation = injectMutation(() => ({
    mutationFn: () => new Promise((resolve) => setTimeout(resolve, 5_000)),
  }))

  constructor() {
    this.mutation.mutate()
  }
}

@Component({
  selector: 'app-after-content-init',
  templateUrl: 'main.html',
})
export class AfterContentInitComponent implements AfterContentInit {
  readonly name = 'AfterContentInit'
  readonly mutation = injectMutation(() => ({
    mutationFn: () => new Promise((resolve) => setTimeout(resolve, 5_000)),
  }))

  ngAfterContentInit(): void {
    this.mutation.mutate()
  }
}

@Component({
  selector: 'app-root',
  imports: [OnInitComponent, ConstructorComponent, AfterContentInitComponent],
  template: `
    <h1>Hallo TanStack Query!</h1>
    <app-on-init />
    <app-constructor />
    <app-after-content-init />
  `,
})
export class App {}

bootstrapApplication(App, {
  providers: [provideTanStackQuery(() => new QueryClient())],
})
