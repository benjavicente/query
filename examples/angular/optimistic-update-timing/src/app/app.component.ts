import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core'
import {
  injectMutation,
  injectQuery,
  QueryClient,
} from '@benjavicente/angular-query'

type Snapshot = {
  phase: string
  cache: string | undefined
  signal: string | undefined
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Optimistic update timing</h1>
    <p>
      Save the title and compare the query cache with the query signal during
      the same update turn, a microtask, and the next animation frame.
    </p>

    @if (editing()) {
      <input [value]="draft()" (input)="draft.set($any($event.target).value)" />
      <button (click)="save()">Save</button>
    } @else {
      <p>
        Rendered title: <output>{{ itemQuery.data() }}</output>
      </p>
    }

    <p>
      Cache now: <output>{{ cacheValue() }}</output>
    </p>
    <p>
      Signal now: <output>{{ itemQuery.data() }}</output>
    </p>
    <p>Mutation: {{ mutation.status() }}</p>

    <h2>Snapshots</h2>
    <ol>
      @for (snapshot of snapshots(); track $index) {
        <li>
          {{ snapshot.phase }} — cache={{ snapshot.cache }}, signal={{
            snapshot.signal
          }}
        </li>
      }
    </ol>
  `,
})
export class AppComponent {
  private readonly queryClient = inject(QueryClient)

  readonly editing = signal(true)
  readonly draft = signal('new title')
  readonly snapshots = signal<Snapshot[]>([])

  readonly itemQuery = injectQuery(() => ({
    queryKey: ['optimistic-timing-item'],
    queryFn: async () => {
      await wait(1000)
      return 'old title'
    },
    initialData: 'old title',
  }))

  readonly mutation = injectMutation(() => ({
    mutationFn: async (title: string) => {
      await wait(1000)
      return title
    },
    onMutate: (title: string) => {
      this.queryClient.setQueryData(['optimistic-timing-item'], title)
      this.record('onMutate / same turn')
    },
  }))

  cacheValue() {
    return this.queryClient.getQueryData<string>(['optimistic-timing-item'])
  }

  save() {
    this.mutation.mutate(this.draft())
    this.editing.set(false)
    this.record('after mutate + edit false')

    queueMicrotask(() => this.record('microtask'))
    requestAnimationFrame(() => this.record('animation frame'))
  }

  private record(phase: string) {
    this.snapshots.update((snapshots) => [
      ...snapshots,
      {
        phase,
        cache: this.cacheValue(),
        signal: this.itemQuery.data(),
      },
    ])
  }
}
