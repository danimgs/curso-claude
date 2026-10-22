import { describe, it, expect, beforeEach } from 'vitest'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import {
    InvalidTableNumberError,
    InvalidCapacityError,
    InvalidTableDescriptionError,
    InvalidTableStatusError,
    DuplicatedTableNumberError
} from '@errors/DomainErrors.js'

describe('TableService', () => {
    let repo: MockTableRepository
    let service: TableService

    const validInput = { restaurantId: 'r1', number: 3, capacity: 4, description: 'Terraza' }

    beforeEach(() => {
        repo = new MockTableRepository()
        service = new TableService(repo)
    })

    describe('create', () => {
        it('crea y guarda la mesa con estado libre por defecto', async () => {
            const result = await service.create(validInput)
            expect(result).toMatchObject({ restaurantId: 'r1', number: 3, capacity: 4, description: 'Terraza', status: 'libre' })
            expect(result.id).toBeTruthy()
            expect(result.createdAt).toBe(result.updatedAt)
            expect(await repo.findById(result.id)).toEqual(result)
        })

        it('respeta el estado indicado y lo normaliza', async () => {
            const result = await service.create({ ...validInput, status: ' Reservada ' })
            expect(result.status).toBe('reservada')
        })

        it.each([undefined, null, '', '   '])('guarda description %o como null', async (description) => {
            const result = await service.create({ ...validInput, description })
            expect(result.description).toBeNull()
        })

        it('recorta los espacios de la descripción', async () => {
            const result = await service.create({ ...validInput, description: '  Ventana  ' })
            expect(result.description).toBe('Ventana')
        })

        it.each([0, -1, 2.5, '3', 'abc', null, undefined])('rechaza number %o con InvalidTableNumberError', async (number) => {
            await expect(service.create({ ...validInput, number })).rejects.toThrow(InvalidTableNumberError)
        })

        it.each([0, 21, 2.5, '4', 'abc', null, undefined])('rechaza capacity %o con InvalidCapacityError', async (capacity) => {
            await expect(service.create({ ...validInput, capacity })).rejects.toThrow(InvalidCapacityError)
        })

        it('acepta las capacidades límite 1 y 20', async () => {
            await expect(service.create({ ...validInput, number: 1, capacity: 1 })).resolves.toBeDefined()
            await expect(service.create({ ...validInput, number: 2, capacity: 20 })).resolves.toBeDefined()
        })

        it('rechaza una descripción de más de 200 caracteres o no textual', async () => {
            await expect(service.create({ ...validInput, description: 'a'.repeat(201) })).rejects.toThrow(InvalidTableDescriptionError)
            await expect(service.create({ ...validInput, description: 42 })).rejects.toThrow(InvalidTableDescriptionError)
        })

        it('mide los 200 caracteres después de recortar', async () => {
            const result = await service.create({ ...validInput, description: ` ${'a'.repeat(200)} ` })
            expect(result.description).toHaveLength(200)
        })

        it.each(['rota', null, 3])('rechaza status %o con InvalidTableStatusError', async (status) => {
            await expect(service.create({ ...validInput, status })).rejects.toThrow(InvalidTableStatusError)
        })

        it('rechaza un número repetido en el mismo restaurante', async () => {
            await service.create(validInput)
            await expect(service.create(validInput)).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('permite el mismo número en otro restaurante', async () => {
            await service.create(validInput)
            await expect(service.create({ ...validInput, restaurantId: 'r2' })).resolves.toBeDefined()
        })
    })
})
