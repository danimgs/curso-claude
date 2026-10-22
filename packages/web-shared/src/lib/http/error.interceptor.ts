import { inject } from '@angular/core'
import type { HttpInterceptorFn } from '@angular/common/http'
import { catchError, throwError } from 'rxjs'
import { Router } from '@angular/router'
import { AuthStore } from '../auth/auth.store'

// Evita lanzar varias navegaciones a /login cuando fallan a la vez varias peticiones con 401
let isRedirecting = false

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router)
  const auth = inject(AuthStore)

  return next(req).pipe(
    catchError(error => {
      // 401: la sesión ya no vale. Se limpia siempre; solo la navegación se protege de duplicados.
      // 403: la sesión es válida pero no tiene permiso, así que no se cierra y el error llega a la UI.
      if (error.status === 401) {
        auth.clearSession()

        if (!isRedirecting && !router.url.includes('/login')) {
          isRedirecting = true
          router.navigate(['/login'], { replaceUrl: true }).finally(() => {
            setTimeout(() => { isRedirecting = false }, 1000)
          })
        }
      }
      return throwError(() => error)
    })
  )
}
