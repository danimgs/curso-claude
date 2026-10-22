import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from '@config/database.js'
import { seedTables } from './seedTables.js'
import { seedRestaurant } from '../test-utils/seedEmployee.js'

describe('seedTables', () => {
    let db: Database

    const tablesOf = (restaurantId: string) => db.all<{ id: string, number: number, capacity: number, status: string }>(
        'SELECT id, number, capacity, status FROM tables WHERE restaurant_id = ? ORDER BY number', [restaurantId]
    )

    beforeEach(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        await seedRestaurant(db, 'rest-1')
        await seedRestaurant(db, 'rest-2')
    })

    afterEach(async () => {
        await db.close()
    })

    it('crea 6 mesas en rest-1 y 4 en rest-2 con capacidades 2, 4 y 6', async () => {
        await seedTables(db)
        const rest1 = await tablesOf('rest-1')
        const rest2 = await tablesOf('rest-2')
        expect(rest1.map(t => t.number)).toEqual([1, 2, 3, 4, 5, 6])
        expect(rest2.map(t => t.number)).toEqual([1, 2, 3, 4])
        expect(new Set([...rest1, ...rest2].map(t => t.capacity))).toEqual(new Set([2, 4, 6]))
    })

    it('deja ocupada solo la mesa 5 de rest-1 y devuelve su id', async () => {
        const occupiedId = await seedTables(db)
        const rest1 = await tablesOf('rest-1')
        const occupied = [...rest1, ...await tablesOf('rest-2')].filter(t => t.status === 'ocupada')
        expect(occupied).toHaveLength(1)
        expect(occupied[0]).toMatchObject({ id: occupiedId, number: 5 })
    })

    it('es idempotente y devuelve siempre la misma mesa', async () => {
        const first = await seedTables(db)
        const second = await seedTables(db)
        expect(second).toBe(first)
        expect(await tablesOf('rest-1')).toHaveLength(6)
        expect(await tablesOf('rest-2')).toHaveLength(4)
    })
})
