import { describe, it, expect } from 'vitest'
import { Email } from './Email.js'
import { InvalidEmailError } from '@errors/DomainErrors.js'

describe('Email', () => {
    it('normaliza a minúsculas y recorta espacios', () => {
        expect(new Email('  Admin@Resttek.COM ').getValue()).toBe('admin@resttek.com')
    })

    it('rechaza un formato inválido', () => {
        expect(() => new Email('no-es-un-email')).toThrow(InvalidEmailError)
    })
})
