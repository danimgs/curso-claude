import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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
