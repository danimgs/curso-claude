import type { IEmployeeRepository } from '@employee/domain/IEmployeeRepository.js'
import type { IAuthService } from '@employee/domain/IAuthService.js'
import { InvalidCredentialsError } from '@errors/DomainErrors.js'

// Hash bcrypt (coste 10) de una contraseña que nadie conoce
const DUMMY_PASSWORD_HASH = '$2b$10$NtLjDjpoBnhGdXhCYUZSFu8ZyhTFqCcXB6UBjlYSl9xpSAD5HVrdC'

export interface LoginDTO {
    email: string
    passwordRaw: string
}

export interface LoginResponse {
    token: string
    employee: {
        id: string
        firstName: string
        lastName: string
        email: string
        role: string
        restaurantId: string | null
    }
}

export class LoginUseCase {
    constructor(
        private employeeRepository: IEmployeeRepository,
        private authService: IAuthService
    ) {}

    async execute(dto: LoginDTO): Promise<LoginResponse> {
        const email = typeof dto.email === 'string' ? dto.email.trim().toLowerCase() : dto.email
        const employee = await this.employeeRepository.findByEmail(email)

        if (!employee) {
            // Se compara igualmente contra un hash ficticio para que el tiempo de respuesta
            // no delate si el email existe.
            await this.authService.comparePasswords(dto.passwordRaw, DUMMY_PASSWORD_HASH)
            throw new InvalidCredentialsError()
        }

        const isValid = await this.authService.comparePasswords(dto.passwordRaw, employee.passwordHash)
        if (!isValid) {
            throw new InvalidCredentialsError()
        }

        const token = this.authService.generateToken({
            id: employee.id,
            role: employee.role,
            restaurantId: employee.restaurantId
        })

        return {
            token,
            employee: {
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                email: employee.email,
                role: employee.role,
                restaurantId: employee.restaurantId
            }
        }
    }
}
