import { describe, it, expect } from 'vitest'
import { Injector, runInInjectionContext } from '@angular/core'
import { HttpRequest, type HttpEvent } from '@angular/common/http'
import { of, firstValueFrom } from 'rxjs'
import { AuthStore } from '../auth/auth.store'
import { API_URL } from '../tokens'
import { authInterceptor } from './auth.interceptor'

const authorizationFor = async (url: string, token: string | null, apiUrl = '/api/v1') => {
  const injector = Injector.create({
    providers: [
      { provide: AuthStore, useValue: { token: () => token } },
      { provide: API_URL, useValue: apiUrl }
    ]
  })
  let sent: HttpRequest<unknown> | undefined
  await runInInjectionContext(injector, () =>
    firstValueFrom(authInterceptor(new HttpRequest('GET', url), req => {
      sent = req
      return of({} as HttpEvent<unknown>)
    }))
  )
  return sent!.headers.get('Authorization')
}

describe('authInterceptor', () => {
  it('añade el Bearer a las peticiones a la API', async () => {
    expect(await authorizationFor('/api/v1/orders/active', 'tok')).toBe('Bearer tok')
    expect(await authorizationFor('/api/v1', 'tok')).toBe('Bearer tok')
  })

  it('no añade nada si no hay token', async () => {
    expect(await authorizationFor('/api/v1/orders/active', null)).toBeNull()
  })

  it.each([
    'https://sitio-externo.example/api/v1/orders',
    '//sitio-externo.example/api/v1/orders',
    '/otra-ruta/algo',
    '/assets/logo.png',
    '/api/v1evil/orders',
    '/api/v10/orders'
  ])('no filtra el token a %s', async (url) => {
    expect(await authorizationFor(url, 'tok')).toBeNull()
  })

  it('funciona con una API en otro origen absoluto', async () => {
    expect(await authorizationFor('https://api.resttek.com/v1/orders', 'tok', 'https://api.resttek.com/v1')).toBe('Bearer tok')
    expect(await authorizationFor('https://otro.example/v1/orders', 'tok', 'https://api.resttek.com/v1')).toBeNull()
  })
})
