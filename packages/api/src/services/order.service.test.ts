import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import { MockDishRepository } from '@repositories/mocks/MockDishRepository.js'
import { MockRestaurantRepository } from '@repositories/mocks/MockRestaurantRepository.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import type { Order } from '@models/order.model.js'
import { OrderNotFoundError, InvalidOrderStatusError, InvalidStatusTransitionError } from '@errors/DomainErrors.js'

describe('OrderService.updateItemStatus', () => {
    let repo: MockOrderRepository
    let service: OrderService
    let testOrder: Order

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo, new MockDishRepository(), new MockRestaurantRepository(), new MockTableRepository())

        testOrder = {
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: null,
            createdAt: new Date(),
            items: [
                { id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }
            ]
        }
        await repo.create(testOrder)
    })

    it('should update the status of an item successfully', async () => {
        await service.updateItemStatus('order-1', 'item-1', 'preparando')
        const updatedItem = testOrder.items[0]!
        expect(updatedItem.status).toBe('preparando')
    })

    it('should throw an error if the order does not exist', async () => {
        await expect(service.updateItemStatus('order-bad', 'item-1', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw an error if the item does not exist inside the order', async () => {
        await expect(service.updateItemStatus('order-1', 'item-bad', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw DomainError if status is invalid', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'invalid-status'))
            .rejects.toThrow(InvalidOrderStatusError)
    })
})

describe('OrderService autorización y scoping', () => {
    let repo: MockOrderRepository
    let service: OrderService

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo, new MockDishRepository(), new MockRestaurantRepository(), new MockTableRepository())
        await repo.create({
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: 'client-1',
            createdAt: new Date(),
            items: [{ id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }]
        })
    })

    describe('updateItemStatus', () => {
        it('rechaza personal de otro restaurante', async () => {
            await expect(service.updateItemStatus('order-1', 'item-1', 'preparando', 'rest-2'))
                .rejects.toThrow(OrderNotFoundError)
        })

        it('permite personal del mismo restaurante', async () => {
            await expect(service.updateItemStatus('order-1', 'item-1', 'preparando', 'rest-1'))
                .resolves.toBeUndefined()
        })

        it('permite admin (null)', async () => {
            await expect(service.updateItemStatus('order-1', 'item-1', 'preparando', null))
                .resolves.toBeUndefined()
        })
    })

    describe('getById', () => {
        it('permite al cliente propietario', async () => {
            const order = await service.getById('order-1', { id: 'client-1', role: 'cliente', restaurantId: null })
            expect(order.id).toBe('order-1')
        })

        it('rechaza a otro cliente', async () => {
            await expect(service.getById('order-1', { id: 'client-2', role: 'cliente', restaurantId: null }))
                .rejects.toThrow(OrderNotFoundError)
        })

        it('permite personal del mismo restaurante', async () => {
            const order = await service.getById('order-1', { id: 'emp-1', role: 'camarero', restaurantId: 'rest-1' })
            expect(order.id).toBe('order-1')
        })

        it('rechaza personal de otro restaurante', async () => {
            await expect(service.getById('order-1', { id: 'emp-2', role: 'cocinero', restaurantId: 'rest-2' }))
                .rejects.toThrow(OrderNotFoundError)
        })

        it('permite admin', async () => {
            const order = await service.getById('order-1', { id: 'adm', role: 'admin', restaurantId: null })
            expect(order.id).toBe('order-1')
        })
    })
})

describe('OrderService.updateItemStatus: transiciones de estado', () => {
    const setup = async (status: 'pendiente' | 'preparando' | 'listo' | 'entregado') => {
        const repo = new MockOrderRepository()
        const service = new OrderService(repo, new MockDishRepository(), new MockRestaurantRepository(), new MockTableRepository())
        const order: Order = {
            id: 'o1', restaurantId: 'r1', tableId: null, clientId: null, createdAt: new Date(),
            items: [{ id: 'i1', dishId: 'd1', quantity: 1, notes: null, status }]
        }
        await repo.create(order)
        return { service, item: order.items[0]! }
    }

    it.each([
        ['pendiente', 'preparando'],
        ['preparando', 'listo'],
        ['listo', 'entregado'],
        ['pendiente', 'listo']
    ] as const)('permite avanzar de %s a %s', async (from, to) => {
        const { service, item } = await setup(from)
        await service.updateItemStatus('o1', 'i1', to)
        expect(item.status).toBe(to)
    })

    it.each([
        ['entregado', 'pendiente'],
        ['entregado', 'listo'],
        ['listo', 'preparando'],
        ['listo', 'pendiente'],
        ['preparando', 'pendiente']
    ] as const)('rechaza retroceder de %s a %s', async (from, to) => {
        const { service, item } = await setup(from)
        await expect(service.updateItemStatus('o1', 'i1', to)).rejects.toThrow(InvalidStatusTransitionError)
        expect(item.status).toBe(from)
    })

    it('repetir el mismo estado no falla ni cambia nada', async () => {
        const { service, item } = await setup('preparando')
        await expect(service.updateItemStatus('o1', 'i1', 'preparando')).resolves.toBeUndefined()
        expect(item.status).toBe('preparando')
    })
})
