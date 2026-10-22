import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AuthStore } from './auth.store'

class FakeStorage {
  private data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
  removeItem(key: string): void { this.data.delete(key) }
}

const user = { id: 'u1', firstName: 'Ana', lastName: 'Gil', email: 'ana@resttek.com', role: 'camarero', restaurantId: 'r1' }

describe('AuthStore: carga de la sesión guardada', () => {
  let storage: FakeStorage

  beforeEach(() => {
    storage = new FakeStorage()
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('restaura el usuario guardado', () => {
    storage.setItem('auth_token', tokenExpiringIn(600))
    storage.setItem('auth_user', JSON.stringify(user))
    const store = new AuthStore()
    expect(store.user()).toEqual(user)
    expect(store.userRole()).toBe('camarero')
  })

  it('no lanza con un auth_user corrupto y empieza sin sesión', () => {
    storage.setItem('auth_token', tokenExpiringIn(600))
    storage.setItem('auth_user', '{esto no es json')
    expect(() => new AuthStore()).not.toThrow()
    const store = new AuthStore()
    expect(store.user()).toBeNull()
    expect(store.isAuthenticated()).toBe(false)
  })

  it('limpia el almacenamiento cuando está corrupto', () => {
    storage.setItem('auth_token', tokenExpiringIn(600))
    storage.setItem('auth_user', '[1,2')
    new AuthStore()
    expect(storage.getItem('auth_user')).toBeNull()
    expect(storage.getItem('auth_token')).toBeNull()
  })

  it.each([
    ['un número', '5'],
    ['un string', '"hola"'],
    ['un array', '[1]'],
    ['un objeto sin role', '{"id":"u1"}']
  ])('descarta un auth_user que es %s', (_nombre, raw) => {
    storage.setItem('auth_token', tokenExpiringIn(600))
    storage.setItem('auth_user', raw)
    const store = new AuthStore()
    expect(store.user()).toBeNull()
    expect(store.isAuthenticated()).toBe(false)
  })

  it('sin nada guardado empieza sin sesión', () => {
    const store = new AuthStore()
    expect(store.user()).toBeNull()
    expect(store.token()).toBeNull()
  })
})

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const tokenExpiringIn = (seconds: number) =>
  `${b64url({ alg: 'HS256' })}.${b64url({ exp: Math.floor(Date.now() / 1000) + seconds })}.firma`

describe('AuthStore: caducidad del token', () => {
  let storage: FakeStorage

  beforeEach(() => {
    storage = new FakeStorage()
    vi.stubGlobal('localStorage', storage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('descarta al arrancar una sesión guardada con el token caducado', () => {
    storage.setItem('auth_token', tokenExpiringIn(-60))
    storage.setItem('auth_user', JSON.stringify(user))
    const store = new AuthStore()
    expect(store.isAuthenticated()).toBe(false)
    expect(store.user()).toBeNull()
    expect(storage.getItem('auth_token')).toBeNull()
  })

  it('conserva una sesión con el token vigente', () => {
    storage.setItem('auth_token', tokenExpiringIn(600))
    storage.setItem('auth_user', JSON.stringify(user))
    const store = new AuthStore()
    expect(store.isAuthenticated()).toBe(true)
    expect(store.hasValidSession()).toBe(true)
  })

  it('hasValidSession limpia la sesión si el token caduca con la app abierta', () => {
    const store = new AuthStore()
    store.setSession(tokenExpiringIn(-1), user)
    expect(store.hasValidSession()).toBe(false)
    expect(store.token()).toBeNull()
    expect(storage.getItem('auth_user')).toBeNull()
  })

  it('hasValidSession es false sin sesión', () => {
    expect(new AuthStore().hasValidSession()).toBe(false)
  })
})
