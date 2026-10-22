import { describe, it, expect, vi } from 'vitest'
import { Injector, runInInjectionContext } from '@angular/core'
import { Router } from '@angular/router'
import { AuthStore } from './auth.store'
import { authGuard } from './auth.guard'

const run = (hasValidSession: boolean) => {
  const clearSession = vi.fn()
  const injector = Injector.create({
    providers: [
      { provide: AuthStore, useValue: { hasValidSession: () => hasValidSession, isAuthenticated: () => hasValidSession, clearSession } },
      { provide: Router, useValue: { createUrlTree: (commands: string[]) => ({ redirect: commands[0] }) } }
    ]
  })
  return runInInjectionContext(injector, () => authGuard({} as any, {} as any))
}

describe('authGuard', () => {
  it('permite pasar con una sesión válida', () => {
    expect(run(true)).toBe(true)
  })

  it('redirige a /login sin sesión válida (p. ej. token caducado)', () => {
    expect(run(false)).toEqual({ redirect: '/login' })
  })
})
