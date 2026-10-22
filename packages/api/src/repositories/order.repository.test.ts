import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Database } from '@config/database.js'
import { SqliteOrderRepository } from './order.repository.js'
import type { Order } from '@models/order.model.js'

describe('SqliteOrderRepository.create (Integration)', () => {
    let db: Database
    let repo: SqliteOrderRepository
    const now = new Date().toISOString()

    const order = (id: string, dishIds: string[]): Order => ({
        id,
        restaurantId: 'r1',
        tableId: null,
        clientId: null,
        createdAt: new Date(),
        items: dishIds.map((dishId, i) => ({
            id: `${id}-item-${i}`, dishId, quantity: 1, notes: null, status: 'pendiente' as const
        }))
    })

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteOrderRepository(db)
        await db.run(
            'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['r1', 'La Trattoria', 'Calle Mayor 10', 'info@trattoria.com', '+34 612345678', 'Carlos', 'García', now, now]
        )
        await db.run(
            'INSERT INTO dishes (id, name, description, price, category, available, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['d1', 'Pizza', null, 9, 'principal', 1, 'r1', now, now]
        )
    })

    afterAll(async () => {
        await db.close()
    })

    it('guarda el pedido con todos sus ítems', async () => {
        await repo.create(order('o-ok', ['d1', 'd1']))
        const found = await repo.findById('o-ok')
        expect(found?.items).toHaveLength(2)
    })

    it('no deja un pedido a medias si falla la inserción de un ítem', async () => {
        await expect(repo.create(order('o-roto', ['d1', 'plato-inexistente']))).rejects.toThrow()
        expect(await repo.findById('o-roto')).toBeNull()
        const rows = await db.all('SELECT id FROM order_items WHERE order_id = ?', ['o-roto'])
        expect(rows).toHaveLength(0)
    })
})

describe('SqliteOrderRepository.findActiveByRestaurant: número de mesa (Integration)', () => {
    let db: Database
    let repo: SqliteOrderRepository
    const now = new Date().toISOString()

    const order = (id: string, tableId: string | null): Order => ({
        id,
        restaurantId: 'r1',
        tableId,
        clientId: null,
        createdAt: new Date(),
        items: [{ id: `${id}-item`, dishId: 'd1', quantity: 1, notes: null, status: 'pendiente' as const }]
    })

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteOrderRepository(db)
        await db.run(
            'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['r1', 'La Trattoria', 'Calle Mayor 10', 'info@trattoria.com', '+34 612345678', 'Carlos', 'García', now, now]
        )
        await db.run(
            'INSERT INTO dishes (id, name, description, price, category, available, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['d1', 'Pizza', null, 9, 'principal', 1, 'r1', now, now]
        )
        await db.run(
            'INSERT INTO tables (id, restaurant_id, number, description, capacity, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            ['mesa-7', 'r1', 7, null, 4, 'ocupada', now, now]
        )
        await repo.create(order('con-mesa', 'mesa-7'))
        await repo.create(order('sin-mesa', null))
        await repo.create(order('mesa-borrada', 'mesa-que-ya-no-existe'))
    })

    afterAll(async () => {
        await db.close()
    })

    it('devuelve tableNumber de la mesa, o null sin mesa o si la mesa ya no existe', async () => {
        const orders = await repo.findActiveByRestaurant('r1')
        const byId = Object.fromEntries(orders.map(o => [o.id, o]))
        expect(byId['con-mesa']).toMatchObject({ tableId: 'mesa-7', tableNumber: 7 })
        expect(byId['sin-mesa']).toMatchObject({ tableId: null, tableNumber: null })
        expect(byId['mesa-borrada']).toMatchObject({ tableId: 'mesa-que-ya-no-existe', tableNumber: null })
    })

    it('obtiene el número de mesa sin consultas extra por pedido', async () => {
        const all = vi.spyOn(db, 'all')
        const get = vi.spyOn(db, 'get')
        const orders = await repo.findActiveByRestaurant('r1')
        // una consulta para los pedidos (con la mesa) y otra por pedido para sus ítems
        expect(all).toHaveBeenCalledTimes(1 + orders.length)
        expect(get).not.toHaveBeenCalled()
        all.mockRestore()
        get.mockRestore()
    })
})
