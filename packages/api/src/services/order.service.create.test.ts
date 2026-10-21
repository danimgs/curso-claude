import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import { InvalidOrderError } from '@errors/DomainErrors.js'

describe('OrderService.create: validación de entrada', () => {
    let repo: MockOrderRepository
    let service: OrderService

    const create = (items: unknown) => service.create({
        restaurantId: 'rest-1',
        tableId: null,
        clientId: 'cliente-1',
        items: items as any
    })

    beforeEach(() => {
        repo = new MockOrderRepository()
        service = new OrderService(repo)
    })

    it('crea un ítem por unidad con una petición válida', async () => {
        const order = await create([{ dishId: 'd1', quantity: 2, notes: 'sin sal' }])
        expect(order.items).toHaveLength(2)
        expect(repo.orders).toHaveLength(1)
    })

    it.each([
        ['items no es un array', 'x'],
        ['items vacío', []],
        ['items con más de 50 elementos', Array.from({ length: 51 }, () => ({ dishId: 'd1', quantity: 1, notes: null }))],
        ['un elemento que no es objeto', [null]]
    ])('rechaza %s', async (_nombre, items) => {
        await expect(create(items)).rejects.toThrow(InvalidOrderError)
        expect(repo.orders).toHaveLength(0)
    })

    it.each([0, -1, 1.5, 21, 1e9, '2', null, undefined, NaN])('rechaza quantity %s', async (quantity) => {
        await expect(create([{ dishId: 'd1', quantity, notes: null }])).rejects.toThrow(InvalidOrderError)
        expect(repo.orders).toHaveLength(0)
    })

    it('rechaza un dishId vacío o que no es texto', async () => {
        await expect(create([{ dishId: '', quantity: 1, notes: null }])).rejects.toThrow(InvalidOrderError)
        await expect(create([{ dishId: 5, quantity: 1, notes: null }])).rejects.toThrow(InvalidOrderError)
    })

    it('rechaza notas de más de 200 caracteres y acepta exactamente 200', async () => {
        await expect(create([{ dishId: 'd1', quantity: 1, notes: 'a'.repeat(201) }])).rejects.toThrow(InvalidOrderError)
        await expect(create([{ dishId: 'd1', quantity: 1, notes: 'a'.repeat(200) }])).resolves.toBeDefined()
    })

    it('rechaza notas que no son texto', async () => {
        await expect(create([{ dishId: 'd1', quantity: 1, notes: 5 }])).rejects.toThrow(InvalidOrderError)
    })
})
