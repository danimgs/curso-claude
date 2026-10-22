import { WeakPasswordError } from '@errors/DomainErrors.js'

const MIN_LENGTH = 10

export class Password {
    static assertValid(plain: unknown, email: string): void {
        if (typeof plain !== 'string' || plain.length < MIN_LENGTH || plain.toLowerCase() === email.toLowerCase()) {
            throw new WeakPasswordError()
        }
    }
}
