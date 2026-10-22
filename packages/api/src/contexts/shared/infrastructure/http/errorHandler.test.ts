import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Request, Response } from 'express'
import { errorHandler } from './errorHandler.js'
import { logger } from '@config/logger.js'
import { WeakPasswordError, OrderNotFoundError } from '@errors/DomainErrors.js'

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

describe('errorHandler: otros errores', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('OrderNotFoundError responde 404', () => {
        const { res, json } = run(new OrderNotFoundError())
        expect(res.status).toHaveBeenCalledWith(404)
        expect(json).toHaveBeenCalledWith({ error: 'OrderNotFoundError', message: 'Order not found' })
    })

    it('un JSON malformado responde 400 sin detalles internos', () => {
        const err = Object.assign(new SyntaxError('Unexpected token } in JSON at position 7'), { status: 400, type: 'entity.parse.failed' })
        const { res, json } = run(err)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(json).toHaveBeenCalledWith({ error: 'InvalidJson', message: 'The request body is not valid JSON' })
    })

    it('un cuerpo demasiado grande responde 413', () => {
        const err = Object.assign(new Error('request entity too large'), { status: 413, type: 'entity.too.large' })
        const { res, json } = run(err)
        expect(res.status).toHaveBeenCalledWith(413)
        expect(json).toHaveBeenCalledWith({ error: 'PayloadTooLarge', message: 'The request body is too large' })
    })

    it('un error inesperado responde 500 genérico y se registra', () => {
        const spy = vi.spyOn(logger, 'error')
        const boom = new Error('SQLITE_CONSTRAINT: FOREIGN KEY constraint failed')
        const { res, json } = run(boom)
        expect(res.status).toHaveBeenCalledWith(500)
        expect(json).toHaveBeenCalledWith({ error: 'InternalServerError', message: 'Something went wrong' })
        expect(spy).toHaveBeenCalledWith({ err: boom, event: 'unhandled_error' }, 'Unhandled error')
    })
})
