import { inject } from '@angular/core'
import type { HttpInterceptorFn } from '@angular/common/http'
import { AuthStore } from '../auth/auth.store'
import { API_URL } from '../tokens'

// Coincide con la propia API: el prefijo exacto o una ruta/consulta que cuelgue de él.
// '/api/v1evil' o 'https://otro.example/api/v1' no cuentan.
function isApiRequest(url: string, apiUrl: string): boolean {
  if (!url.startsWith(apiUrl)) return false
  const next = url.charAt(apiUrl.length)
  return next === '' || next === '/' || next === '?' || next === '#'
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token()
  // El token solo se envía a la API propia, nunca a otros orígenes ni a otras rutas
  if (!token || !isApiRequest(req.url, inject(API_URL))) return next(req)

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  }))
}
