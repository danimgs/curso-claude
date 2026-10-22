import { Injectable, signal, computed } from '@angular/core'
import { isTokenExpired } from './jwt.util'

export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  restaurantId: string | null
}

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate['id'] === 'string' && typeof candidate['role'] === 'string'
}

// Lee la sesión guardada sin fiarse de su contenido: localStorage lo puede editar el usuario.
// Si algo no cuadra se descarta toda la sesión en lugar de romper la app al arrancar.
function readStoredSession(): { token: string | null; user: AuthUser | null } {
  if (typeof localStorage === 'undefined') return { token: null, user: null }

  const token = localStorage.getItem(TOKEN_KEY)
  const rawUser = localStorage.getItem(USER_KEY)
  if (token === null && rawUser === null) return { token: null, user: null }

  try {
    const user: unknown = JSON.parse(rawUser ?? 'null')
    if (token !== null && isAuthUser(user) && !isTokenExpired(token)) return { token, user }
  } catch {
    // JSON corrupto: se trata igual que una sesión inválida
  }

  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  return { token: null, user: null }
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly stored = readStoredSession()
  private readonly _token = signal<string | null>(this.stored.token)
  private readonly _user = signal<AuthUser | null>(this.stored.user)

  readonly token = this._token.asReadonly()
  readonly user = this._user.asReadonly()
  readonly isAuthenticated = computed(() => this._token() !== null)
  readonly userRole = computed(() => this._user()?.role ?? null)

  /**
   * Comprueba en este momento que hay sesión y que el token no ha caducado; si caducó, la limpia.
   * El computed `isAuthenticated` no se reevalúa con el paso del tiempo, por eso el guard usa este método.
   */
  hasValidSession(): boolean {
    const token = this._token()
    if (token === null) return false
    if (isTokenExpired(token)) {
      this.clearSession()
      return false
    }
    return true
  }

  setSession(token: string, user: AuthUser): void {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    this._token.set(token)
    this._user.set(user)
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    this._token.set(null)
    this._user.set(null)
  }
}
