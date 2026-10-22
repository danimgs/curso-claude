import { describe, it, expect } from 'vitest'
import { normalizeTableStatus } from './table.model.js'
import { InvalidTableStatusError } from '@errors/DomainErrors.js'

describe('normalizeTableStatus', () => {
    it('acepta los tres estados válidos', () => {
        for (const status of ['libre', 'ocupada', 'reservada']) {
            expect(normalizeTableStatus(status)).toBe(status)
        }
    })

    it('normaliza mayúsculas y espacios', () => {
        expect(normalizeTableStatus(' Libre ')).toBe('libre')
    })

    it('rechaza un estado desconocido con el mensaje del contrato', () => {
        expect(() => normalizeTableStatus('rota')).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus('rota')).toThrow('Estado inválido: rota. Debe ser uno de: libre, ocupada, reservada')
    })

    it('rechaza null y valores no textuales', () => {
        expect(() => normalizeTableStatus(null)).toThrow('Estado inválido: null. Debe ser uno de: libre, ocupada, reservada')
        expect(() => normalizeTableStatus(undefined)).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus(3)).toThrow(InvalidTableStatusError)
    })
})
