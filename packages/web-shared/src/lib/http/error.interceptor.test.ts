import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Injector, runInInjectionContext } from '@angular/core'
import { HttpRequest, HttpErrorResponse } from '@angular/common/http'
import { Router } from '@angular/router'
import { throwError, firstValueFrom } from 'rxjs'
import { AuthStore } from '../auth/auth.store'
import { errorInterceptor } from './error.interceptor'

describe('errorInterceptor', () => {
  let clearSession: ReturnType<typeof vi.fn>
  let navigate: ReturnType<typeof vi.fn>
  let routerUrl: string

  const call = (status: number) => {
    const injector = Injector.create({
      providers: [
        { provide: AuthStore, useValue: { clearSession } },
        { provide: Router, useValue: { get url() { return routerUrl }, navigate } }
      ]
    })
    const error = new HttpErrorResponse({ status })
    return runInInjectionContext(injector, () =>
      firstValueFrom(errorInterceptor(new HttpRequest('GET', '/api/v1/x'), () => throwError(() => error)))
    ).catch(e => e)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    clearSession = vi.fn()
    navigate = vi.fn().mockResolvedValue(true)
    routerUrl = '/cocina'
  })

  afterEach(async () => {
    await vi.advanceTimersByTimeAsync(2000)
    vi.useRealTimers()
  })

  it('en un 401 limpia la sesión, redirige a /login y relanza el error', async () => {
    const error = await call(401)
    expect(error.status).toBe(401)
    expect(clearSession).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true })
  })

  it('limpia la sesión en cada 401 aunque ya se esté redirigiendo, pero navega una sola vez', async () => {
    await call(401)
    await call(401)
    await call(401)
    expect(clearSession).toHaveBeenCalledTimes(3)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('vuelve a poder redirigir pasado un segundo', async () => {
    await call(401)
    await vi.advanceTimersByTimeAsync(1100)
    await call(401)
    expect(navigate).toHaveBeenCalledTimes(2)
  })

  it('en /login limpia la sesión sin navegar', async () => {
    routerUrl = '/login'
    await call(401)
    expect(clearSession).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('un 403 no cierra la sesión ni redirige: relanza el error para mostrarlo', async () => {
    const error = await call(403)
    expect(error.status).toBe(403)
    expect(clearSession).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('otros errores pasan sin tocar la sesión', async () => {
    const error = await call(500)
    expect(error.status).toBe(500)
    expect(clearSession).not.toHaveBeenCalled()
  })
})
