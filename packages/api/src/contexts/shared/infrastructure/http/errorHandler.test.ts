import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { errorHandler } from './errorHandler.js'
import { WeakPasswordError } from '@errors/DomainErrors.js'

function run(err: unknown) {
    const json = vi.fn()
    const res = { status: vi.fn().mockReturnValue({ json }) } as unknown as Response
    errorHandler(err, {} as Request, res, vi.fn())
    return { res, json }
}

describe('errorHandler: WeakPasswordError', () => {
    it('responde 400 con el nombre del error y su mensaje', () => {
        const { res, json } = run(new WeakPasswordError())
        expect(res.status).toHaveBeenCalledWith(400)
        expect(json).toHaveBeenCalledWith({
            error: 'WeakPasswordError',
            message: 'Password must be at least 10 characters long and different from the email'
        })
    })
})
