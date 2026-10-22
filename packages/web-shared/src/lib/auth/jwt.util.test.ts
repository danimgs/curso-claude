import { describe, it, expect } from 'vitest'
import { decodeJwtExpiry, isTokenExpired } from './jwt.util'

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const jwt = (payload: object) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.firma`

describe('decodeJwtExpiry', () => {
  it('devuelve exp en segundos', () => {
    expect(decodeJwtExpiry(jwt({ exp: 1_900_000_000 }))).toBe(1_900_000_000)
  })

  it.each([
    ['sin exp', jwt({ id: 'u1' })],
    ['exp que no es número', jwt({ exp: '1900000000' })],
    ['exp no finito', `${b64url({})}.${Buffer.from('{"exp":1e999}').toString('base64url')}.f`],
    ['sin tres partes', 'abc.def'],
    ['payload que no es base64 de JSON', 'a.%%%.c'],
    ['cadena vacía', '']
  ])('devuelve null con un token %s', (_nombre, token) => {
    expect(decodeJwtExpiry(token)).toBeNull()
  })
})

describe('isTokenExpired', () => {
  const now = 1_800_000_000_000

  it('no ha caducado antes de exp', () => {
    expect(isTokenExpired(jwt({ exp: 1_800_000_100 }), now)).toBe(false)
  })

  it('ha caducado en el instante de exp y después', () => {
    expect(isTokenExpired(jwt({ exp: 1_800_000_000 }), now)).toBe(true)
    expect(isTokenExpired(jwt({ exp: 1_700_000_000 }), now)).toBe(true)
  })

  it('un token ilegible o sin exp se trata como caducado', () => {
    expect(isTokenExpired('basura', now)).toBe(true)
    expect(isTokenExpired(jwt({ id: 'u1' }), now)).toBe(true)
  })
})
