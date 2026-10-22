import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import { MockDishRepository } from '@repositories/mocks/MockDishRepository.js'
import { MockRestaurantRepository } from '@repositories/mocks/MockRestaurantRepository.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import type { Table, TableStatusType } from '@models/table.model.js'
import type { Dish } from '@models/dish.model.js'
import type { Restaurant } from '@models/restaurant.model.js'
import { InvalidOrderError, RestaurantNotFoundError, DishNotFoundError, DishNotAvailableError, TableNotFoundError, TableNotOccupiedError } from '@errors/DomainErrors.js'

const restaurant = (id: string): Restaurant => ({
    id, name: id, address: 'c/1', email: `${id}@x.com`, phone: '600000000',
    ownerFirstName: 'o', ownerLastName: 'p', logoUrl: null, createdAt: '', updatedAt: ''
})

const dish = (id: string, restaurantId: string, available = true): Dish => ({
    id, name: id, description: null, price: 5, category: 'principal', available,
    restaurantId, ingredients: [], createdAt: '', updatedAt: ''
})

const table = (id: string, restaurantId: string, status: TableStatusType): Table => ({
    id, restaurantId, number: 1, description: null, capacity: 4, status, createdAt: '', updatedAt: ''
})

describe('OrderService.create: validación de entrada', () => {
    let repo: MockOrderRepository
    let service: OrderService

    const create = (items: unknown) => service.create({
        restaurantId: 'rest-1',
        tableId: null,
        clientId: 'cliente-1',
        items: items as any
    })

    let dishes: MockDishRepository
    let restaurants: MockRestaurantRepository
    let tables: MockTableRepository

    beforeEach(async () => {
        repo = new MockOrderRepository()
        dishes = new MockDishRepository()
        restaurants = new MockRestaurantRepository()
        tables = new MockTableRepository()
        service = new OrderService(repo, dishes, restaurants, tables)
        await restaurants.save(restaurant('rest-1'))
        await restaurants.save(restaurant('rest-2'))
        await dishes.save(dish('d1', 'rest-1'))
        await dishes.save(dish('otro-restaurante', 'rest-2'))
        await dishes.save(dish('agotado', 'rest-1', false))
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

    describe('platos y restaurante', () => {
        it('rechaza un restaurante que no existe', async () => {
            await expect(service.create({
                restaurantId: 'no-existe', tableId: null, clientId: null,
                items: [{ dishId: 'd1', quantity: 1, notes: null }]
            })).rejects.toThrow(RestaurantNotFoundError)
            expect(repo.orders).toHaveLength(0)
        })

        it('rechaza un plato que no existe', async () => {
            await expect(create([{ dishId: 'fantasma', quantity: 1, notes: null }])).rejects.toThrow(DishNotFoundError)
            expect(repo.orders).toHaveLength(0)
        })

        it('rechaza un plato de otro restaurante como si no existiera', async () => {
            await expect(create([{ dishId: 'otro-restaurante', quantity: 1, notes: null }])).rejects.toThrow(DishNotFoundError)
            expect(repo.orders).toHaveLength(0)
        })

        it('rechaza un plato no disponible', async () => {
            await expect(create([{ dishId: 'agotado', quantity: 1, notes: null }])).rejects.toThrow(DishNotAvailableError)
            expect(repo.orders).toHaveLength(0)
        })

        it('no guarda nada si solo falla uno de los platos', async () => {
            await expect(create([
                { dishId: 'd1', quantity: 1, notes: null },
                { dishId: 'agotado', quantity: 1, notes: null }
            ])).rejects.toThrow(DishNotAvailableError)
            expect(repo.orders).toHaveLength(0)
        })
    })

    describe('mesa', () => {
        const createWithTable = (tableId: unknown, items: unknown = [{ dishId: 'd1', quantity: 1, notes: null }]) => service.create({
            restaurantId: 'rest-1', tableId: tableId as any, clientId: 'cliente-1', items: items as any
        })

        beforeEach(async () => {
            await tables.save(table('ocupada', 'rest-1', 'ocupada'))
            await tables.save(table('libre', 'rest-1', 'libre'))
            await tables.save(table('reservada', 'rest-1', 'reservada'))
            await tables.save(table('ajena', 'rest-2', 'ocupada'))
        })

        it('crea el pedido asociado a una mesa ocupada del restaurante', async () => {
            const order = await createWithTable('ocupada')
            expect(order.tableId).toBe('ocupada')
            expect(repo.orders).toHaveLength(1)
        })

        it('sigue aceptando pedidos sin mesa', async () => {
            const order = await createWithTable(null)
            expect(order.tableId).toBeNull()
        })

        it.each(['fantasma', 'ajena'])('rechaza la mesa %s con TableNotFoundError', async (tableId) => {
            await expect(createWithTable(tableId)).rejects.toThrow(TableNotFoundError)
            expect(repo.orders).toHaveLength(0)
        })

        it.each(['libre', 'reservada'])('rechaza una mesa %s con TableNotOccupiedError', async (tableId) => {
            await expect(createWithTable(tableId)).rejects.toThrow(TableNotOccupiedError)
            expect(repo.orders).toHaveLength(0)
        })

        it.each([5, true, {}])('rechaza tableId %o que no es texto', async (tableId) => {
            await expect(createWithTable(tableId)).rejects.toThrow('tableId debe ser texto o null')
            expect(repo.orders).toHaveLength(0)
        })

        it('valida la mesa después de los platos', async () => {
            await expect(createWithTable('libre', [{ dishId: 'fantasma', quantity: 1, notes: null }])).rejects.toThrow(DishNotFoundError)
        })
    })
})
