import { describe, it, expect, vi } from 'vitest'
import type { Response } from 'express'
import { authorizeRestaurant, type AuthRequest, type AuthUser } from './middlewares.js'

function run(user: AuthUser | undefined, restaurantId: string) {
    const req = { user, params: { restaurantId } } as unknown as AuthRequest
    const json = vi.fn()
    const res = { status: vi.fn().mockReturnValue({ json }) } as unknown as Response
    const next = vi.fn()
    authorizeRestaurant(req, res, next)
    return { res, json, next }
}

describe('authorizeRestaurant', () => {
    it('deja pasar a un admin en cualquier restaurante', () => {
        const { next } = run({ id: 'u1', role: 'admin', restaurantId: null }, 'rest-b')
        expect(next).toHaveBeenCalled()
    })

    it('deja pasar al personal de su propio restaurante', () => {
        const { next } = run({ id: 'u2', role: 'manager', restaurantId: 'rest-a' }, 'rest-a')
        expect(next).toHaveBeenCalled()
    })

    it('devuelve 403 al personal de otro restaurante', () => {
        const { res, next } = run({ id: 'u2', role: 'manager', restaurantId: 'rest-a' }, 'rest-b')
        expect(next).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
    })

    it('devuelve 403 a un usuario sin restaurante', () => {
        const { res, next } = run({ id: 'u3', role: 'cliente', restaurantId: null }, 'rest-a')
        expect(next).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
    })

    it('devuelve 403 si no hay usuario autenticado', () => {
        const { res, next } = run(undefined, 'rest-a')
        expect(next).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
    })
})
