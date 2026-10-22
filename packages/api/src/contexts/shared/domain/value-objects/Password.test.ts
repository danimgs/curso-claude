import { describe, it, expect } from 'vitest'
import { Password } from './Password.js'
import { WeakPasswordError } from '@errors/DomainErrors.js'

describe('Password.assertValid', () => {
    it('acepta una contraseña de 10 o más caracteres distinta del email', () => {
        expect(() => Password.assertValid('claveSegura1', 'a@resttek.com')).not.toThrow()
    })

    it('rechaza una contraseña de menos de 10 caracteres', () => {
        expect(() => Password.assertValid('corta123', 'a@resttek.com')).toThrow(WeakPasswordError)
    })

    it('rechaza una contraseña igual al email, sin distinguir mayúsculas', () => {
        expect(() => Password.assertValid('Admin@Resttek.com', 'admin@resttek.com')).toThrow(WeakPasswordError)
    })

    it('rechaza valores que no son texto', () => {
        expect(() => Password.assertValid(undefined, 'a@resttek.com')).toThrow(WeakPasswordError)
        expect(() => Password.assertValid(123456789012, 'a@resttek.com')).toThrow(WeakPasswordError)
    })
})
