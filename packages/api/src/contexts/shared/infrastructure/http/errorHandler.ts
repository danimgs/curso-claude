import type { Request, Response, NextFunction } from 'express'
import { AppError } from '@errors/AppError.js'
import { logger } from '@config/logger.js'

const NOT_FOUND_ERRORS = [
    'EmployeeNotFoundError',
    'RestaurantNotFoundError',
    'IngredientNotFoundError',
    'DishNotFoundError',
    'OrderNotFoundError'
]

const UNAUTHORIZED_ERRORS = [
    'InvalidCredentialsError'
]

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof AppError) {
        let statusCode = 400

        if (NOT_FOUND_ERRORS.includes(err.name)) {
            statusCode = 404
        } else if (UNAUTHORIZED_ERRORS.includes(err.name)) {
            statusCode = 401
        }

        res.status(statusCode).json({
            error: err.name,
            message: err.message
        })
        return
    }

    // Errores de express.json (body-parser): JSON mal formado o cuerpo demasiado grande
    if (err?.type === 'entity.parse.failed') {
        res.status(400).json({ error: 'InvalidJson', message: 'The request body is not valid JSON' })
        return
    }
    if (err?.type === 'entity.too.large') {
        res.status(413).json({ error: 'PayloadTooLarge', message: 'The request body is too large' })
        return
    }

    logger.error({ err, event: 'unhandled_error' }, 'Unhandled error')
    res.status(500).json({ error: 'InternalServerError', message: 'Something went wrong' })
}
