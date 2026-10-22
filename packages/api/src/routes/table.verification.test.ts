import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Server } from 'http'
import type { AddressInfo } from 'net'
import { BcryptAuthService } from '@employee/infrastructure/BcryptAuthService.js'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { seedEmployee, seedRestaurant } from '../test-utils/seedEmployee.js'

// Verificación de la sección 6 del plan (docs/plans/2026-10-22-gestion-de-mesas.md)
// contra la API real: servidor en un puerto libre y BD en memoria.

const authService = new BcryptAuthService()
const ADMIN = 'admin-1'
const MANAGER_R1 = 'man-1'
const CAMARERO_R1 = 'cam-1'
const COCINERO_R1 = 'coc-1'
const CLIENTE = 'cli-1'

let server: Server
let baseUrl: string

async function api(method: string, path: string, options: { as?: string, body?: unknown } = {}) {
    const headers: Record<string, string> = {}
    if (options.as) headers.Authorization = `Bearer ${authService.generateToken({ id: options.as })}`
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
    })
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : undefined }
}

const createTable = async (restaurantId: string, body: object) => {
    const res = await api('POST', `/restaurants/${restaurantId}/tables`, { as: ADMIN, body })
    expect(res.status).toBe(201)
    return res.body.id as string
}

describe('Verificación de la API de mesas (sección 6 del plan)', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
        await seedRestaurant(dbConfig, 'rest-1')
        await seedRestaurant(dbConfig, 'rest-2')
        await seedEmployee(dbConfig, { id: ADMIN, role: 'admin' })
        await seedEmployee(dbConfig, { id: MANAGER_R1, role: 'manager', restaurantId: 'rest-1' })
        await seedEmployee(dbConfig, { id: CAMARERO_R1, role: 'camarero', restaurantId: 'rest-1' })
        await seedEmployee(dbConfig, { id: COCINERO_R1, role: 'cocinero', restaurantId: 'rest-1' })
        await seedEmployee(dbConfig, { id: CLIENTE, role: 'cliente' })
        const now = new Date().toISOString()
        await dbConfig.run(
            'INSERT INTO dishes (id, name, description, price, category, available, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['d1', 'Pizza', null, 9, 'principal', 1, 'rest-1', now, now]
        )
        await new Promise<void>(resolve => { server = app.listen(0, () => resolve()) })
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })

    afterAll(async () => {
        await new Promise(resolve => server.close(resolve))
        await dbConfig.close()
    })

    describe('alta de mesas', () => {
        it('POST como admin → 201 con status libre', async () => {
            const res = await api('POST', '/restaurants/rest-1/tables', { as: ADMIN, body: { number: 10, capacity: 4, description: 'Terraza' } })
            expect(res.status).toBe(201)
            expect(res.body).toMatchObject({ restaurantId: 'rest-1', number: 10, capacity: 4, description: 'Terraza', status: 'libre' })
        })

        it('repetir el número → 409 DuplicatedTableNumberError', async () => {
            const res = await api('POST', '/restaurants/rest-1/tables', { as: ADMIN, body: { number: 10, capacity: 4 } })
            expect(res.status).toBe(409)
            expect(res.body).toEqual({ error: 'DuplicatedTableNumberError', message: 'Ya existe una mesa con ese número en el restaurante' })
        })

        it.each([
            [{ number: 0, capacity: 4 }, 'InvalidTableNumberError'],
            [{ number: '3', capacity: 4 }, 'InvalidTableNumberError'],
            [{ number: 2.5, capacity: 4 }, 'InvalidTableNumberError'],
            [{ number: 11, capacity: 25 }, 'InvalidCapacityError'],
            [{ number: 11, capacity: null }, 'InvalidCapacityError'],
            [{ number: 11, capacity: 4, status: 'rota' }, 'InvalidTableStatusError'],
            [{ number: 11, capacity: 4, status: null }, 'InvalidTableStatusError'],
            [{ number: 11, capacity: 4, description: 'a'.repeat(201) }, 'InvalidTableDescriptionError']
        ])('%o → 400 %s', async (body, error) => {
            const res = await api('POST', '/restaurants/rest-1/tables', { as: ADMIN, body })
            expect(res.status).toBe(400)
            expect(res.body.error).toBe(error)
            expect(typeof res.body.message).toBe('string')
        })

        it('una descripción de solo espacios se guarda como null', async () => {
            const res = await api('POST', '/restaurants/rest-1/tables', { as: ADMIN, body: { number: 12, capacity: 2, description: '   ' } })
            expect(res.status).toBe(201)
            expect(res.body.description).toBeNull()
        })
    })

    describe('permisos por restaurante', () => {
        it('GET de rest-2 con un manager de rest-1 → 403', async () => {
            const res = await api('GET', '/restaurants/rest-2/tables', { as: MANAGER_R1 })
            expect(res.status).toBe(403)
        })

        it('PUT en rest-1 de una mesa de rest-2 como admin → 404', async () => {
            const tableR2 = await createTable('rest-2', { number: 1, capacity: 4 })
            const res = await api('PUT', `/restaurants/rest-1/tables/${tableR2}`, { as: ADMIN, body: { number: 1, capacity: 4 } })
            expect(res.status).toBe(404)
            expect(res.body.error).toBe('TableNotFoundError')
        })
    })

    describe('cambio de estado', () => {
        it('camarero de rest-1 → 200; cocinero → 403', async () => {
            const id = await createTable('rest-1', { number: 20, capacity: 4 })
            const ok = await api('PATCH', `/restaurants/rest-1/tables/${id}/status`, { as: CAMARERO_R1, body: { status: 'reservada' } })
            expect(ok.status).toBe(200)
            expect(ok.body.status).toBe('reservada')
            const ko = await api('PATCH', `/restaurants/rest-1/tables/${id}/status`, { as: COCINERO_R1, body: { status: 'libre' } })
            expect(ko.status).toBe(403)
        })
    })

    describe('listado público', () => {
        it('partySize=5 → solo mesas libres con capacidad ≥ 5', async () => {
            await createTable('rest-1', { number: 30, capacity: 6 })
            await createTable('rest-1', { number: 31, capacity: 8, status: 'ocupada' })
            await createTable('rest-1', { number: 32, capacity: 8, status: 'reservada' })
            await createTable('rest-1', { number: 33, capacity: 5 })
            const res = await api('GET', '/public/restaurants/rest-1/tables?partySize=5')
            expect(res.status).toBe(200)
            expect(res.body.map((t: { number: number }) => t.number)).toEqual([33, 30])
            for (const t of res.body) {
                expect(Object.keys(t).sort()).toEqual(['capacity', 'description', 'id', 'number'])
            }
        })

        it.each(['?partySize=0', '?partySize=abc', '?partySize=2.5', '?partySize=21', ''])('%s → 400 InvalidPartySizeError', async (query) => {
            const res = await api('GET', `/public/restaurants/rest-1/tables${query}`)
            expect(res.status).toBe(400)
            expect(res.body.error).toBe('InvalidPartySizeError')
        })
    })

    describe('ocupar mesa', () => {
        it('cliente → 200 ocupada; repetir → 409; camarero → 403', async () => {
            const id = await createTable('rest-1', { number: 40, capacity: 2 })
            expect((await api('POST', `/restaurants/rest-1/tables/${id}/occupy`, { as: CAMARERO_R1 })).status).toBe(403)
            const ok = await api('POST', `/restaurants/rest-1/tables/${id}/occupy`, { as: CLIENTE })
            expect(ok.status).toBe(200)
            expect(ok.body.status).toBe('ocupada')
            const again = await api('POST', `/restaurants/rest-1/tables/${id}/occupy`, { as: CLIENTE })
            expect(again.status).toBe(409)
            expect(again.body).toEqual({ error: 'TableNotAvailableError', message: 'La mesa ya no está disponible' })
        })

        it('dos clientes a la vez: solo uno ocupa la mesa', async () => {
            const id = await createTable('rest-1', { number: 41, capacity: 2 })
            const results = await Promise.all([1, 2, 3].map(() => api('POST', `/restaurants/rest-1/tables/${id}/occupy`, { as: CLIENTE })))
            expect(results.map(r => r.status).sort()).toEqual([200, 409, 409])
        })

        it('una mesa de otro restaurante → 404', async () => {
            const tableR2 = await createTable('rest-2', { number: 2, capacity: 2 })
            const res = await api('POST', `/restaurants/rest-1/tables/${tableR2}/occupy`, { as: CLIENTE })
            expect(res.status).toBe(404)
        })
    })

    describe('borrado', () => {
        it('ocupada → 409 TableOccupiedError; libre → 204', async () => {
            const ocupada = await createTable('rest-1', { number: 50, capacity: 2, status: 'ocupada' })
            const del = await api('DELETE', `/restaurants/rest-1/tables/${ocupada}`, { as: ADMIN })
            expect(del.status).toBe(409)
            expect(del.body.error).toBe('TableOccupiedError')
            const libre = await createTable('rest-1', { number: 51, capacity: 2 })
            const ok = await api('DELETE', `/restaurants/rest-1/tables/${libre}`, { as: ADMIN })
            expect(ok.status).toBe(204)
            expect(ok.body).toBeUndefined()
        })
    })

    describe('pedidos con mesa', () => {
        const order = (tableId: unknown) => api('POST', '/orders', {
            as: CLIENTE,
            body: { restaurantId: 'rest-1', tableId, items: [{ dishId: 'd1', quantity: 2, notes: null }] }
        })

        it('mesa inexistente o de otro restaurante → 404 TableNotFoundError', async () => {
            const tableR2 = await createTable('rest-2', { number: 3, capacity: 2, status: 'ocupada' })
            for (const tableId of ['fantasma', tableR2]) {
                const res = await order(tableId)
                expect(res.status).toBe(404)
                expect(res.body.error).toBe('TableNotFoundError')
            }
        })

        it.each(['libre', 'reservada'])('mesa %s → 409 TableNotOccupiedError', async (status) => {
            const id = await createTable('rest-1', { number: status === 'libre' ? 60 : 61, capacity: 2, status })
            const res = await order(id)
            expect(res.status).toBe(409)
            expect(res.body).toEqual({ error: 'TableNotOccupiedError', message: 'La mesa no está ocupada' })
        })

        it('mesa ocupada → 201 y GET /orders/active devuelve su tableId', async () => {
            const id = await createTable('rest-1', { number: 62, capacity: 2 })
            await api('POST', `/restaurants/rest-1/tables/${id}/occupy`, { as: CLIENTE })
            const created = await order(id)
            expect(created.status).toBe(201)
            expect(created.body.tableId).toBe(id)
            expect(created.body.items).toHaveLength(2)
            const active = await api('GET', '/orders/active', { as: CAMARERO_R1 })
            expect(active.status).toBe(200)
            const found = active.body.find((o: { id: string }) => o.id === created.body.id)
            expect(found.tableId).toBe(id)
            expect(found.tableNumber).toBe(62)
        })

        it('tableId que no es texto → 400 InvalidOrderError', async () => {
            const res = await order(5)
            expect(res.status).toBe(400)
            expect(res.body).toEqual({ error: 'InvalidOrderError', message: 'tableId debe ser texto o null' })
        })
    })
})
