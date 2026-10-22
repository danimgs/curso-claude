import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { TableController } from './table.controller.js'
import { TableService } from '@services/table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import { TableNotFoundError, TableNotAvailableError, InvalidPartySizeError } from '@errors/DomainErrors.js'
import type { Table } from '@models/table.model.js'

const TABLE_KEYS = ['capacity', 'createdAt', 'description', 'id', 'number', 'restaurantId', 'status', 'updatedAt']

function call(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>, req: Partial<Request>) {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
    }
    const next = vi.fn()
    return handler(req as Request, res as unknown as Response, next).then(() => ({ res, next }))
}

describe('TableController', () => {
    let repo: MockTableRepository
    let controller: TableController
    let table: Table

    beforeEach(async () => {
        repo = new MockTableRepository()
        const service = new TableService(repo)
        controller = new TableController(service)
        table = await service.create({ restaurantId: 'r1', number: 3, capacity: 4, description: 'Terraza' })
    })

    it('create responde 201 con la mesa del restaurante de la ruta', async () => {
        const { res } = await call(controller.create, {
            params: { restaurantId: 'r1' },
            body: { number: 10, capacity: 4, restaurantId: 'r2', status: 'reservada' }
        })
        expect(res.status).toHaveBeenCalledWith(201)
        const body = res.json.mock.calls[0]![0]
        expect(Object.keys(body).sort()).toEqual(TABLE_KEYS)
        expect(body).toMatchObject({ restaurantId: 'r1', number: 10, capacity: 4, description: null, status: 'reservada' })
    })

    it('getAll responde 200 con la lista', async () => {
        const { res } = await call(controller.getAll, { params: { restaurantId: 'r1' } })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith([table])
    })

    it('getById responde 200 o pasa TableNotFoundError a next', async () => {
        const ok = await call(controller.getById, { params: { restaurantId: 'r1', id: table.id } })
        expect(ok.res.json).toHaveBeenCalledWith(table)
        const ko = await call(controller.getById, { params: { restaurantId: 'r2', id: table.id } })
        expect(ko.next).toHaveBeenCalledWith(expect.any(TableNotFoundError))
    })

    it('update responde 200 con la mesa editada', async () => {
        const { res } = await call(controller.update, {
            params: { restaurantId: 'r1', id: table.id },
            body: { number: 5, capacity: 6, description: 'Salón' }
        })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json.mock.calls[0]![0]).toMatchObject({ id: table.id, number: 5, capacity: 6, description: 'Salón', status: 'libre' })
    })

    it('delete responde 204 sin cuerpo', async () => {
        const { res } = await call(controller.delete, { params: { restaurantId: 'r1', id: table.id } })
        expect(res.status).toHaveBeenCalledWith(204)
        expect(res.send).toHaveBeenCalledWith()
        expect(await repo.findById(table.id)).toBeNull()
    })

    it('updateStatus responde 200 con la mesa', async () => {
        const { res } = await call(controller.updateStatus, {
            params: { restaurantId: 'r1', id: table.id },
            body: { status: 'reservada' }
        })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json.mock.calls[0]![0]).toMatchObject({ id: table.id, status: 'reservada' })
    })

    it('occupy responde 200 con la mesa completa y después pasa TableNotAvailableError', async () => {
        const first = await call(controller.occupy, { params: { restaurantId: 'r1', id: table.id } })
        expect(first.res.status).toHaveBeenCalledWith(200)
        const body = first.res.json.mock.calls[0]![0]
        expect(Object.keys(body).sort()).toEqual(TABLE_KEYS)
        expect(body.status).toBe('ocupada')
        const second = await call(controller.occupy, { params: { restaurantId: 'r1', id: table.id } })
        expect(second.next).toHaveBeenCalledWith(expect.any(TableNotAvailableError))
    })

    it('getAvailable responde 200 solo con id, number, description y capacity', async () => {
        const { res } = await call(controller.getAvailable, { params: { restaurantId: 'r1' }, query: { partySize: '2' } })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith([{ id: table.id, number: 3, description: 'Terraza', capacity: 4 }])
    })

    it('getAvailable pasa InvalidPartySizeError a next si falta partySize', async () => {
        const { next } = await call(controller.getAvailable, { params: { restaurantId: 'r1' }, query: {} })
        expect(next).toHaveBeenCalledWith(expect.any(InvalidPartySizeError))
    })
})
