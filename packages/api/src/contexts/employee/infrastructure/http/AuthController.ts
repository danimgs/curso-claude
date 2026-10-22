import type { Request, Response, NextFunction } from 'express'
import type { LoginUseCase } from '@employee/application/LoginUseCase.js'
import type { RegisterClientUseCase } from '@employee/application/RegisterClientUseCase.js'
import { InvalidCredentialsError } from '@errors/DomainErrors.js'
import { logger } from '@config/logger.js'

export class AuthController {
    constructor(
        private loginUseCase: LoginUseCase,
        private registerClientUseCase?: RegisterClientUseCase
    ) {}

    login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await this.loginUseCase.execute({
                email: req.body.email,
                passwordRaw: req.body.password
            })
            logger.info({ event: 'login_ok', employeeId: result.employee.id, ip: req.ip }, 'Login correcto')
            res.status(200).json(result)
        } catch (error) {
            if (error instanceof InvalidCredentialsError) {
                logger.warn({ event: 'login_failed', ip: req.ip }, 'Login fallido')
            }
            next(error)
        }
    }

    register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!this.registerClientUseCase) {
                throw new Error('RegisterClientUseCase not configured')
            }
            const result = await this.registerClientUseCase.execute({
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                email: req.body.email,
                password: req.body.password
            })
            res.status(201).json(result)
        } catch (error) {
            next(error)
        }
    }
}
