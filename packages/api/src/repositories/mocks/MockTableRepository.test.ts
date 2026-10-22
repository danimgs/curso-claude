import { describe, it, expect, beforeEach } from 'vitest'
import { MockTableRepository } from './MockTableRepository.js'
import type { Table } from '@models/table.model.js'

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

describe('MockTableRepository', () => {
    let repo: MockTableRepository

    beforeEach(async () => {
        repo = new MockTableRepository()
        await repo.save(table({ id: 't3', number: 3, capacity: 6 }))
        await repo.save(table({ id: 't1', number: 1, capacity: 2 }))
        await repo.save(table({ id: 't2', number: 2, capacity: 4, status: 'ocupada' }))
        await repo.save(table({ id: 't4', number: 4, capacity: 4 }))
        await repo.save(table({ id: 'x1', restaurantId: 'r2', number: 1, capacity: 8 }))
    })

    it('lista las mesas de un restaurante ordenadas por número', async () => {
        const result = await repo.findByRestaurantId('r1')
        expect(result.map(t => t.id)).toEqual(['t1', 't2', 't3', 't4'])
    })

    it('busca por restaurante y número', async () => {
        expect((await repo.findByRestaurantAndNumber('r1', 3))?.id).toBe('t3')
        expect(await repo.findByRestaurantAndNumber('r2', 3)).toBeNull()
    })

    it('findAvailable devuelve solo libres con capacidad suficiente, por capacidad y número', async () => {
        const result = await repo.findAvailable('r1', 3)
        expect(result.map(t => t.id)).toEqual(['t4', 't3'])
    })

    it('occupyIfFree ocupa una mesa libre del restaurante indicado', async () => {
        expect(await repo.occupyIfFree('t1', 'r1', '2026-10-22T10:00:00.000Z')).toBe(true)
        const found = await repo.findById('t1')
        expect(found?.status).toBe('ocupada')
        expect(found?.updatedAt).toBe('2026-10-22T10:00:00.000Z')
    })

    it('occupyIfFree no hace nada si la mesa no está libre o es de otro restaurante', async () => {
        expect(await repo.occupyIfFree('t2', 'r1', 'x')).toBe(false)
        expect(await repo.occupyIfFree('t1', 'r2', 'x')).toBe(false)
        expect(await repo.occupyIfFree('fantasma', 'r1', 'x')).toBe(false)
        expect((await repo.findById('t1'))?.status).toBe('libre')
    })

    it('borra una mesa', async () => {
        await repo.delete('t1')
        expect(await repo.findById('t1')).toBeNull()
    })
})
