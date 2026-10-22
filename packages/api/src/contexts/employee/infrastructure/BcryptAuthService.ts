import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { IAuthService } from '@employee/domain/IAuthService.js'
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE, JWT_EXPIRES_IN_SECONDS } from '@config/env.js'

const SALT_ROUNDS = 10

export class BcryptAuthService implements IAuthService {
    async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, SALT_ROUNDS)
    }

    async comparePasswords(provided: string, stored: string): Promise<boolean> {
        return bcrypt.compare(provided, stored)
    }

    generateToken(payload: any): string {
        return jwt.sign(payload, JWT_SECRET, {
            algorithm: 'HS256',
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
            expiresIn: JWT_EXPIRES_IN_SECONDS
        })
    }
}
