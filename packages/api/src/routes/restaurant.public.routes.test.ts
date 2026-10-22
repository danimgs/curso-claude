import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { dbConfig } from '@config/database.js'
import { BcryptAuthService } from '@employee/infrastructure/BcryptAuthService.js'
import { seedEmployee, seedRestaurant } from '../test-utils/seedEmployee.js'

const PUBLIC_FIELDS = ['address', 'id', 'logoUrl', 'name', 'phone']
const admin = `Bearer ${new BcryptAuthService().generateToken({ id: 'admin-1', role: 'admin', restaurantId: null })}`

describe('API pública de restaurantes', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
        await seedEmployee(dbConfig, { id: 'admin-1', role: 'admin' })
        await seedRestaurant(dbConfig, 'r1')
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    it('el listado público solo expone los campos públicos', async () => {
        const res = await request(app).get('/api/v1/public/restaurants')
        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(1)
        expect(Object.keys(res.body[0]).sort()).toEqual(PUBLIC_FIELDS)
    })

    it('el detalle público funciona sin token y solo expone los campos públicos', async () => {
        const res = await request(app).get('/api/v1/public/restaurants/r1')
        expect(res.status).toBe(200)
        expect(Object.keys(res.body).sort()).toEqual(PUBLIC_FIELDS)
    })

    it('el detalle público de un restaurante inexistente devuelve 404', async () => {
        const res = await request(app).get('/api/v1/public/restaurants/no-existe')
        expect(res.status).toBe(404)
    })

    it('la API autenticada sigue devolviendo todos los datos a un admin', async () => {
        const res = await request(app).get('/api/v1/restaurants/r1').set('Authorization', admin)
        expect(res.status).toBe(200)
        expect(res.body.email).toBe('r1@x.com')
        expect(res.body.ownerFirstName).toBe('O')
    })
})
