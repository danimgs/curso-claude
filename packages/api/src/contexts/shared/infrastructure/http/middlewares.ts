import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } from '@config/env.js'
import { dbConfig } from '@config/database.js'
import { SqliteEmployeeRepository } from '@employee/infrastructure/SqliteEmployeeRepository.js'

const employeeRepository = new SqliteEmployeeRepository(dbConfig)

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
        res.status(401).json({ error: 'Unauthorized: No token provided' })
        return
    }

    const tokenParts = authHeader.split(' ')
    const token = tokenParts[1]
    if (!token) {
        res.status(401).json({ error: 'Unauthorized: Malformed token' })
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
        res.status(401).json({ error: 'Unauthorized: Invalid token' })
        return
    }

    try {
        // El rol y el restaurante salen de la BD, no del token: así un despido o una
        // degradación tienen efecto inmediato sin esperar a que caduque el token.
        const employee = await employeeRepository.findById(String(decoded.id))
        if (!employee) {
            res.status(401).json({ error: 'Unauthorized: Invalid token' })
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
            res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
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
    res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
}
