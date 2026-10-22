import { describe, it, expect, beforeEach } from 'vitest'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import {
    InvalidTableNumberError,
    InvalidCapacityError,
    InvalidTableDescriptionError,
    InvalidTableStatusError,
    DuplicatedTableNumberError,
    TableNotFoundError,
    TableOccupiedError
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

    describe('update', () => {
        it('reemplaza los datos editables y conserva id, restaurante y fecha de creación', async () => {
            const created = await service.create(validInput)
            const updated = await service.update(created.id, 'r1', { number: 5, capacity: 6, description: 'Salón', status: 'reservada' })
            expect(updated).toMatchObject({ id: created.id, restaurantId: 'r1', number: 5, capacity: 6, description: 'Salón', status: 'reservada', createdAt: created.createdAt })
            expect(await repo.findById(created.id)).toEqual(updated)
        })

        it('conserva el estado actual si no se envía status', async () => {
            const created = await service.create({ ...validInput, status: 'ocupada' })
            const updated = await service.update(created.id, 'r1', { number: 3, capacity: 4 })
            expect(updated.status).toBe('ocupada')
            expect(updated.description).toBeNull()
        })

        it('rechaza status null', async () => {
            const created = await service.create(validInput)
            await expect(service.update(created.id, 'r1', { number: 3, capacity: 4, status: null })).rejects.toThrow(InvalidTableStatusError)
        })

        it('aplica las mismas validaciones que create', async () => {
            const created = await service.create(validInput)
            await expect(service.update(created.id, 'r1', { number: 0, capacity: 4 })).rejects.toThrow(InvalidTableNumberError)
            await expect(service.update(created.id, 'r1', { number: 3, capacity: 25 })).rejects.toThrow(InvalidCapacityError)
        })

        it('permite mantener el propio número pero no usar el de otra mesa', async () => {
            const created = await service.create(validInput)
            await service.create({ ...validInput, number: 4 })
            await expect(service.update(created.id, 'r1', { number: 3, capacity: 2 })).resolves.toBeDefined()
            await expect(service.update(created.id, 'r1', { number: 4, capacity: 2 })).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('lanza TableNotFoundError si no existe o es de otro restaurante', async () => {
            const created = await service.create(validInput)
            await expect(service.update('fantasma', 'r1', { number: 3, capacity: 4 })).rejects.toThrow(TableNotFoundError)
            await expect(service.update(created.id, 'r2', { number: 3, capacity: 4 })).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('delete', () => {
        it('borra una mesa libre o reservada', async () => {
            const libre = await service.create(validInput)
            const reservada = await service.create({ ...validInput, number: 4, status: 'reservada' })
            await service.delete(libre.id, 'r1')
            await service.delete(reservada.id, 'r1')
            expect(await repo.findByRestaurantId('r1')).toEqual([])
        })

        it('no borra una mesa ocupada', async () => {
            const created = await service.create({ ...validInput, status: 'ocupada' })
            await expect(service.delete(created.id, 'r1')).rejects.toThrow(TableOccupiedError)
            expect(await repo.findById(created.id)).not.toBeNull()
        })

        it('lanza TableNotFoundError si no existe o es de otro restaurante', async () => {
            const created = await service.create(validInput)
            await expect(service.delete('fantasma', 'r1')).rejects.toThrow(TableNotFoundError)
            await expect(service.delete(created.id, 'r2')).rejects.toThrow(TableNotFoundError)
            expect(await repo.findById(created.id)).not.toBeNull()
        })
    })

    describe('findById', () => {
        it('devuelve la mesa del restaurante', async () => {
            const created = await service.create(validInput)
            expect(await service.findById(created.id, 'r1')).toEqual(created)
        })

        it('lanza TableNotFoundError si no existe o es de otro restaurante', async () => {
            const created = await service.create(validInput)
            await expect(service.findById('fantasma', 'r1')).rejects.toThrow(TableNotFoundError)
            await expect(service.findById(created.id, 'r2')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('findByRestaurantId', () => {
        it('lista solo las mesas del restaurante ordenadas por número', async () => {
            await service.create({ ...validInput, number: 2 })
            await service.create({ ...validInput, number: 1 })
            await service.create({ ...validInput, restaurantId: 'r2' })
            expect((await service.findByRestaurantId('r1')).map(t => t.number)).toEqual([1, 2])
        })
    })
})
