import { inject } from '@angular/core'
import { Router, type CanActivateFn } from '@angular/router'
import { AuthStore } from './auth.store'

/**
 * Restringe una ruta a los roles de `route.data['roles']`.
 * Si el rol no está permitido, redirige a `route.data['homeByRole'][rol]` y, si no hay
 * una ruta definida para ese rol, a /login. Es solo control de navegación: la
 * autorización real la hace la API.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthStore)
  const router = inject(Router)

  const allowed = (route.data['roles'] as string[] | undefined) ?? []
  const role = auth.userRole()

  if (role && allowed.includes(role)) return true

  const homeByRole = (route.data['homeByRole'] as Record<string, string> | undefined) ?? {}
  const home = role ? homeByRole[role] : undefined
  return router.createUrlTree([home ?? '/login'])
}
