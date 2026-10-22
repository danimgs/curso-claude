import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } from '@config/env.js'
import { dbConfig } from '@config/database.js'
import { logger } from '@config/logger.js'
import { SqliteEmployeeRepository } from '@employee/infrastructure/SqliteEmployeeRepository.js'

const employeeRepository = new SqliteEmployeeRepository(dbConfig)

const pathOf = (req: Request): string => req.originalUrl.split('?')[0] ?? ''

const rejectUnauthenticated = (req: Request, res: Response, reason: string, message: string): void => {
    logger.warn({ event: 'auth_rejected', reason, path: pathOf(req), ip: req.ip }, 'Petición no autenticada')
    res.status(401).json({ error: message })
}

const rejectForbidden = (req: AuthRequest, res: Response): void => {
    logger.warn(
        { event: 'forbidden', userId: req.user?.id, role: req.user?.role, path: pathOf(req), ip: req.ip },
        'Acceso denegado por permisos'
    )
    res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
}

export interface AuthUser {
    id: string
    role: string
    restaurantId: string | null
}

export interface AuthRequest extends Request {
    user?: AuthUser
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        rejectUnauthenticated(req, res, 'no_token', 'Unauthorized: No token provided')
        return
    }

    const tokenParts = authHeader.split(' ')
    const token = tokenParts[1]
    if (!token) {
        rejectUnauthenticated(req, res, 'malformed_token', 'Unauthorized: Malformed token')
        return
    }

    let decoded: jwt.JwtPayload
    try {
        decoded = jwt.verify(token, JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        }) as jwt.JwtPayload
    } catch {
        rejectUnauthenticated(req, res, 'invalid_token', 'Unauthorized: Invalid token')
        return
    }

    try {
        // El rol y el restaurante salen de la BD, no del token: así un despido o una
        // degradación tienen efecto inmediato sin esperar a que caduque el token.
        const employee = await employeeRepository.findById(String(decoded.id))
        if (!employee) {
            rejectUnauthenticated(req, res, 'unknown_employee', 'Unauthorized: Invalid token')
            return
        }
        req.user = { id: employee.id, role: employee.role, restaurantId: employee.restaurantId }
        next()
    } catch (error) {
        next(error)
    }
}

export const authorize = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            rejectForbidden(req, res)
            return
        }
        next()
    }
}

export const authorizeRestaurant = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user
    if (user && (user.role === 'admin' || (user.restaurantId && user.restaurantId === req.params.restaurantId))) {
        next()
        return
    }
    rejectForbidden(req, res)
}
