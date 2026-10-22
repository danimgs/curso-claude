import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SqliteTableRepository } from './table.repository.js'
import { Database } from '@config/database.js'
import type { Table } from '@models/table.model.js'
import { seedRestaurant } from '../test-utils/seedEmployee.js'

const table = (overrides: Partial<Table>): Table => ({
    id: 't1',
    restaurantId: 'r1',
    number: 1,
    description: null,
    capacity: 4,
    status: 'libre',
    createdAt: '2026-10-22T09:00:00.000Z',
    updatedAt: '2026-10-22T09:00:00.000Z',
    ...overrides
})

describe('SqliteTableRepository (Integration)', () => {
    let db: Database
    let repo: SqliteTableRepository

    beforeEach(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        await seedRestaurant(db, 'r1')
        await seedRestaurant(db, 'r2')
        repo = new SqliteTableRepository(db)
    })

    afterEach(async () => {
        await db.close()
    })

    it('guarda y recupera una mesa con todos sus campos', async () => {
        const t = table({ description: 'Terraza', status: 'reservada' })
        await repo.save(t)
        expect(await repo.findById('t1')).toEqual(t)
        expect(await repo.findById('fantasma')).toBeNull()
    })

    it('actualiza una mesa existente sin cambiar su restaurante ni su fecha de creación', async () => {
        await repo.save(table({}))
        await repo.save(table({ number: 7, description: 'Salón', capacity: 6, status: 'ocupada', restaurantId: 'r2', createdAt: 'x', updatedAt: '2026-10-22T10:00:00.000Z' }))
        expect(await repo.findById('t1')).toEqual(table({
            number: 7, description: 'Salón', capacity: 6, status: 'ocupada', updatedAt: '2026-10-22T10:00:00.000Z'
        }))
    })

    it('lista las mesas de un restaurante ordenadas por número', async () => {
        await repo.save(table({ id: 't3', number: 3 }))
        await repo.save(table({ id: 't1', number: 1 }))
        await repo.save(table({ id: 'x1', restaurantId: 'r2', number: 2 }))
        expect((await repo.findByRestaurantId('r1')).map(t => t.id)).toEqual(['t1', 't3'])
    })

    it('busca por restaurante y número', async () => {
        await repo.save(table({ id: 't3', number: 3 }))
        expect((await repo.findByRestaurantAndNumber('r1', 3))?.id).toBe('t3')
        expect(await repo.findByRestaurantAndNumber('r2', 3)).toBeNull()
    })

    it('findAvailable devuelve solo libres con capacidad suficiente, por capacidad y número', async () => {
        await repo.save(table({ id: 'a', number: 1, capacity: 2 }))
        await repo.save(table({ id: 'b', number: 2, capacity: 6 }))
        await repo.save(table({ id: 'c', number: 3, capacity: 4 }))
        await repo.save(table({ id: 'd', number: 4, capacity: 4, status: 'ocupada' }))
        await repo.save(table({ id: 'e', number: 5, capacity: 4, status: 'reservada' }))
        await repo.save(table({ id: 'f', number: 0, capacity: 4 }))
        await repo.save(table({ id: 'x', restaurantId: 'r2', number: 1, capacity: 8 }))
        expect((await repo.findAvailable('r1', 3)).map(t => t.id)).toEqual(['f', 'c', 'b'])
    })

    it('occupyIfFree ocupa una mesa libre y solo una vez', async () => {
        await repo.save(table({}))
        expect(await repo.occupyIfFree('t1', 'r1', '2026-10-22T10:00:00.000Z')).toBe(true)
        expect(await repo.occupyIfFree('t1', 'r1', '2026-10-22T11:00:00.000Z')).toBe(false)
        const found = await repo.findById('t1')
        expect(found?.status).toBe('ocupada')
        expect(found?.updatedAt).toBe('2026-10-22T10:00:00.000Z')
    })

    it('occupyIfFree no ocupa mesas de otro restaurante, reservadas ni inexistentes', async () => {
        await repo.save(table({}))
        await repo.save(table({ id: 't2', number: 2, status: 'reservada' }))
        expect(await repo.occupyIfFree('t1', 'r2', 'x')).toBe(false)
        expect(await repo.occupyIfFree('t2', 'r1', 'x')).toBe(false)
        expect(await repo.occupyIfFree('fantasma', 'r1', 'x')).toBe(false)
        expect((await repo.findById('t1'))?.status).toBe('libre')
    })

    it('borra una mesa', async () => {
        await repo.save(table({}))
        await repo.delete('t1')
        expect(await repo.findById('t1')).toBeNull()
    })
})
