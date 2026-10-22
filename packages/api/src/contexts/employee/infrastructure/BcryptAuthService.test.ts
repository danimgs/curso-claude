import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'
import { BcryptAuthService } from './BcryptAuthService.js'

describe('BcryptAuthService.generateToken', () => {
    const service = new BcryptAuthService()
    const payload = { id: 'u1', role: 'manager', restaurantId: 'r1' }

    it('firma con HS256, issuer y audience', () => {
        const decoded = jwt.decode(service.generateToken(payload), { complete: true })!
        expect(decoded.header.alg).toBe('HS256')
        expect(decoded.payload).toMatchObject({ ...payload, iss: 'resttek', aud: 'resttek-web' })
    })

    it('caduca en 1 hora por defecto', () => {
        const decoded = jwt.decode(service.generateToken(payload)) as { iat: number; exp: number }
        expect(decoded.exp - decoded.iat).toBe(3600)
    })
})
