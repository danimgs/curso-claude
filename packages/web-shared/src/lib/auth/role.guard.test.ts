import { describe, it, expect } from 'vitest'
import { Injector, runInInjectionContext } from '@angular/core'
import { Router } from '@angular/router'
import { AuthStore } from './auth.store'
import { roleGuard } from './role.guard'

const HOME = { cocinero: '/cocina', manager: '/cocina', camarero: '/barra' }

const run = (role: string | null, roles: string[]) => {
  const injector = Injector.create({
    providers: [
      { provide: AuthStore, useValue: { userRole: () => role } },
      { provide: Router, useValue: { createUrlTree: (commands: string[]) => ({ redirect: commands[0] }) } }
    ]
  })
  const route: any = { data: { roles, homeByRole: HOME } }
  return runInInjectionContext(injector, () => roleGuard(route, {} as any))
}

describe('roleGuard', () => {
  it('permite un rol incluido en data.roles', () => {
    expect(run('cocinero', ['cocinero', 'manager'])).toBe(true)
  })

  it('redirige a su ruta de inicio a un rol no permitido', () => {
    expect(run('camarero', ['cocinero', 'manager'])).toEqual({ redirect: '/barra' })
    expect(run('cocinero', ['camarero', 'manager'])).toEqual({ redirect: '/cocina' })
  })

  it('redirige a /login si el rol no tiene ruta de inicio', () => {
    expect(run('cliente', ['cocinero', 'manager'])).toEqual({ redirect: '/login' })
  })

  it('redirige a /login si no hay rol', () => {
    expect(run(null, ['cocinero'])).toEqual({ redirect: '/login' })
  })
})
