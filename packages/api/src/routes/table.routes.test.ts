import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { BcryptAuthService } from '@employee/infrastructure/BcryptAuthService.js'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { seedEmployee, seedRestaurant } from '../test-utils/seedEmployee.js'

const authService = new BcryptAuthService()
const token = (id: string) => `Bearer ${authService.generateToken({ id })}`
const admin = token('admin-1')
const managerR1 = token('man-1')
const camareroR1 = token('cam-1')
const cocineroR1 = token('coc-1')
const cliente = token('cli-1')

const base = (restaurantId: string) => `/api/v1/restaurants/${restaurantId}/tables`

describe('API de mesas: rutas y permisos', () => {
    let tableR1: string
    let tableR2: string

    beforeAll(async () => {
        await dbConfig.initialize()
        await seedRestaurant(dbConfig, 'r1')
        await seedRestaurant(dbConfig, 'r2')
        await seedEmployee(dbConfig, { id: 'admin-1', role: 'admin' })
        await seedEmployee(dbConfig, { id: 'man-1', role: 'manager', restaurantId: 'r1' })
        await seedEmployee(dbConfig, { id: 'cam-1', role: 'camarero', restaurantId: 'r1' })
        await seedEmployee(dbConfig, { id: 'coc-1', role: 'cocinero', restaurantId: 'r1' })
        await seedEmployee(dbConfig, { id: 'cli-1', role: 'cliente' })
        tableR1 = (await request(app).post(base('r1')).set('Authorization', admin).send({ number: 1, capacity: 4 })).body.id
        tableR2 = (await request(app).post(base('r2')).set('Authorization', admin).send({ number: 1, capacity: 4 })).body.id
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    it('el admin crea una mesa (201)', async () => {
        const res = await request(app).post(base('r1')).set('Authorization', admin).send({ number: 2, capacity: 2 })
        expect(res.status).toBe(201)
        expect(res.body).toMatchObject({ restaurantId: 'r1', number: 2, status: 'libre' })
    })

    it('sin token responde 401', async () => {
        const res = await request(app).get(base('r1'))
        expect(res.status).toBe(401)
    })

    it.each([['manager', managerR1], ['camarero', camareroR1]])('solo el admin crea, edita y borra mesas (%s → 403)', async (_role, auth) => {
        expect((await request(app).post(base('r1')).set('Authorization', auth).send({ number: 9, capacity: 2 })).status).toBe(403)
        expect((await request(app).put(`${base('r1')}/${tableR1}`).set('Authorization', auth).send({ number: 1, capacity: 2 })).status).toBe(403)
        expect((await request(app).delete(`${base('r1')}/${tableR1}`).set('Authorization', auth)).status).toBe(403)
    })

    it.each([['admin', admin], ['manager', managerR1], ['camarero', camareroR1]])('%s ve las mesas y cambia su estado', async (_role, auth) => {
        expect((await request(app).get(base('r1')).set('Authorization', auth)).status).toBe(200)
        expect((await request(app).get(`${base('r1')}/${tableR1}`).set('Authorization', auth)).status).toBe(200)
        const res = await request(app).patch(`${base('r1')}/${tableR1}/status`).set('Authorization', auth).send({ status: 'libre' })
        expect(res.status).toBe(200)
    })

    it.each([['cocinero', cocineroR1], ['cliente', cliente]])('%s no ve las mesas ni cambia su estado (403)', async (_role, auth) => {
        expect((await request(app).get(base('r1')).set('Authorization', auth)).status).toBe(403)
        expect((await request(app).patch(`${base('r1')}/${tableR1}/status`).set('Authorization', auth).send({ status: 'libre' })).status).toBe(403)
    })

    it('el personal de otro restaurante recibe 403', async () => {
        const res = await request(app).get(base('r2')).set('Authorization', managerR1)
        expect(res.status).toBe(403)
        expect(res.body).toEqual({ error: 'Forbidden: Insufficient permissions' })
    })

    it('una mesa de otro restaurante se trata como inexistente (404)', async () => {
        const res = await request(app).put(`${base('r1')}/${tableR2}`).set('Authorization', admin).send({ number: 1, capacity: 2 })
        expect(res.status).toBe(404)
        expect(res.body).toEqual({ error: 'TableNotFoundError', message: 'Mesa no encontrada' })
    })

    it('solo el cliente puede ocupar una mesa', async () => {
        const created = (await request(app).post(base('r1')).set('Authorization', admin).send({ number: 3, capacity: 2 })).body.id
        expect((await request(app).post(`${base('r1')}/${created}/occupy`).set('Authorization', camareroR1)).status).toBe(403)
        const res = await request(app).post(`${base('r1')}/${created}/occupy`).set('Authorization', cliente)
        expect(res.status).toBe(200)
        expect(res.body.status).toBe('ocupada')
    })

    it('el listado público no necesita token', async () => {
        const res = await request(app).get('/api/v1/public/restaurants/r2/tables?partySize=2')
        expect(res.status).toBe(200)
        expect(res.body).toEqual([{ id: tableR2, number: 1, description: null, capacity: 4 }])
    })
})
