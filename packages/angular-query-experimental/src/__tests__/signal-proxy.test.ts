import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  isSignal,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core'
import { beforeEach, describe, expect, test } from 'vitest'
import { signalProxy } from '../signal-proxy'
import { TestBed } from '@angular/core/testing'
import { registerSignalInput } from './test-utils'

describe('signalProxy', () => {
  const inputSignal = signal({ fn: () => 'bar', baz: 'qux' })
  const proxy = signalProxy(inputSignal)

  test('should have reactive fields that return values directly', () => {
    expect(proxy.baz).toEqual('qux')
    expect(isSignal(proxy.baz)).toBe(false)
  })

  test('should pass through functions as-is', () => {
    expect(proxy.fn()).toEqual('bar')
    expect(isSignal(proxy.fn)).toBe(false)
  })

  test('supports "in" operator', () => {
    expect('baz' in proxy).toBe(true)
    expect('foo' in proxy).toBe(false)
  })

  test('supports "Object.keys"', () => {
    expect(Object.keys(proxy)).toEqual(['fn', 'baz'])
  })

  describe('with component input', () => {
    beforeEach(() => {
      TestBed.resetTestingModule()
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection()],
      })
    })

    test('should work with component input wraped on a function', () => {
      @Component({
        standalone: true,
        template: '',
        changeDetection: ChangeDetectionStrategy.OnPush,
      })
      class TestComponent {
        in = input.required<string>()
        derived = computed(() => ({ in: this.in(), fn: () => 'bar' }))
        proxy = signalProxy(this.derived)
        inProxied = computed(() => this.proxy.in)
        fn = () => this.proxy.fn()
      }
      registerSignalInput(TestComponent, 'in')
      const fixture = TestBed.createComponent(TestComponent)
      fixture.componentRef.setInput('in', 'value')
      fixture.detectChanges()

      expect(fixture.componentInstance.inProxied()).toBe('value')
      expect(fixture.componentInstance.fn()).toBe('bar')
    })

    test('should not work with component input not wraped on a function', () => {
      @Component({
        standalone: true,
        template: '',
      })
      class TestComponent {
        in = input.required<string>()
        derived = computed(() => ({ in: this.in(), fn: () => 'bar' }))
        proxy = signalProxy(this.derived)
        inProxied = this.proxy.in
        fn = this.proxy.fn
      }

      registerSignalInput(TestComponent, 'in')
      expect(() => TestBed.createComponent(TestComponent)).toThrow(/NG0950/)
    })
  })
})
