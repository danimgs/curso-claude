import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from './database.js'
import { seedRestaurant } from '../test-utils/seedEmployee.js'

describe('Database: tabla tables', () => {
    let db: Database
    const now = new Date().toISOString()
    const insertTable = (id: string, restaurantId: string, number: number) => db.run(
        'INSERT INTO tables (id, restaurant_id, number, description, capacity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, restaurantId, number, null, 4, now, now]
    )

    beforeEach(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        await seedRestaurant(db, 'r1')
        await seedRestaurant(db, 'r2')
    })

    afterEach(async () => {
        await db.close()
    })

    it('crea la tabla al arrancar con el estado libre por defecto', async () => {
        await insertTable('t1', 'r1', 1)
        const row = await db.get<{ status: string }>('SELECT status FROM tables WHERE id = ?', ['t1'])
        expect(row?.status).toBe('libre')
    })

    it('impide repetir el número de mesa en el mismo restaurante', async () => {
        await insertTable('t1', 'r1', 1)
        await expect(insertTable('t2', 'r1', 1)).rejects.toThrow(/UNIQUE/)
    })

    it('permite el mismo número en restaurantes distintos', async () => {
        await insertTable('t1', 'r1', 1)
        await expect(insertTable('t2', 'r2', 1)).resolves.toBeDefined()
    })

    it('exige que el restaurante exista', async () => {
        await expect(insertTable('t1', 'fantasma', 1)).rejects.toThrow(/FOREIGN KEY/)
    })
})
