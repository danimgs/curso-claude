import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { BcryptAuthService } from '@employee/infrastructure/BcryptAuthService.js'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { seedEmployee } from '../test-utils/seedEmployee.js'

const authService = new BcryptAuthService()
const token = (payload: object) => `Bearer ${authService.generateToken(payload)}`
const cliente = token({ id: 'cli-1', role: 'cliente', restaurantId: null })
const cocineroR2 = token({ id: 'coc-2', role: 'cocinero', restaurantId: 'r2' })
const now = new Date().toISOString()

describe('API de pedidos: errores', () => {
    let orderId: string
    let itemId: string

    beforeAll(async () => {
        await dbConfig.initialize()
        for (const id of ['r1', 'r2']) {
            await dbConfig.run(
                'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, id, 'Calle 1', `${id}@x.com`, '+34 612345678', 'O', 'P', now, now]
            )
        }
        await seedEmployee(dbConfig, { id: 'cli-1', role: 'cliente' })
        await seedEmployee(dbConfig, { id: 'coc-2', role: 'cocinero', restaurantId: 'r2' })
        await seedEmployee(dbConfig, { id: 'a', role: 'admin' })
        await dbConfig.run(
            'INSERT INTO dishes (id, name, description, price, category, available, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['d1', 'Pizza', null, 9, 'principal', 1, 'r1', now, now]
        )
        const res = await request(app).post('/api/v1/orders').set('Authorization', cliente)
            .send({ restaurantId: 'r1', tableId: null, items: [{ dishId: 'd1', quantity: 1, notes: null }] })
        orderId = res.body.id
        itemId = res.body.items[0].id
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    it('POST /orders con un plato inexistente devuelve 404 con el nombre del error', async () => {
        const res = await request(app).post('/api/v1/orders').set('Authorization', cliente)
            .send({ restaurantId: 'r1', tableId: null, items: [{ dishId: 'fantasma', quantity: 1, notes: null }] })
        expect(res.status).toBe(404)
        expect(res.body.error).toBe('DishNotFoundError')
    })

    it('POST /orders con quantity enorme devuelve 400 y no se cuelga', async () => {
        const res = await request(app).post('/api/v1/orders').set('Authorization', cliente)
            .send({ restaurantId: 'r1', tableId: null, items: [{ dishId: 'd1', quantity: 1e9, notes: null }] })
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('InvalidOrderError')
    })

    it('POST /orders con items que no es una lista devuelve 400', async () => {
        const res = await request(app).post('/api/v1/orders').set('Authorization', cliente)
            .send({ restaurantId: 'r1', tableId: null, items: 'x' })
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('InvalidOrderError')
    })

    it('PATCH del estado desde otro restaurante usa el formato de error común', async () => {
        const res = await request(app).patch(`/api/v1/orders/${orderId}/items/${itemId}/status`)
            .set('Authorization', cocineroR2).send({ status: 'listo' })
        expect(res.body.error).toBe('OrderNotFoundError')
        expect(res.body.message).toBe('Order not found')
    })

    it('PATCH con un estado inválido devuelve 400 con InvalidOrderStatusError', async () => {
        const admin = token({ id: 'a', role: 'admin', restaurantId: null })
        const res = await request(app).patch(`/api/v1/orders/${orderId}/items/${itemId}/status`)
            .set('Authorization', admin).send({ status: 'volando' })
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('InvalidOrderStatusError')
    })
})
