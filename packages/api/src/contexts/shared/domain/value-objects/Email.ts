import { InvalidEmailError } from '@errors/DomainErrors.js'

export class Email {
    private readonly value: string

    constructor(value: string) {
        const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value
        if (!this.isValid(normalized)) {
            throw new InvalidEmailError()
        }
        this.value = normalized
    }

    private isValid(email: string): boolean {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return regex.test(email)
    }

    public getValue(): string {
        return this.value
    }
}
