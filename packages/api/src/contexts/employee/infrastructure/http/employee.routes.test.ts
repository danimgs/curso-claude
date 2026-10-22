import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../../../../app.js'
import { dbConfig } from '@config/database.js'
import { BcryptAuthService } from '@employee/infrastructure/BcryptAuthService.js'
import { seedEmployee } from '../../../../test-utils/seedEmployee.js'

const admin = `Bearer ${new BcryptAuthService().generateToken({ id: 'admin-1', role: 'admin', restaurantId: null })}`
const list = (query: string) => request(app).get(`/api/v1/employees${query}`).set('Authorization', admin)

describe('GET /employees: paginación', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
        await seedEmployee(dbConfig, { id: 'admin-1', role: 'admin' })
        for (let i = 0; i < 120; i++) {
            await seedEmployee(dbConfig, { id: `emp-${i}`, role: 'cliente' })
        }
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    it('devuelve 10 empleados por defecto', async () => {
        expect((await list('')).body).toHaveLength(10)
    })

    it('respeta un limit razonable', async () => {
        expect((await list('?limit=25')).body).toHaveLength(25)
    })

    it('limita a 100 un limit enorme', async () => {
        const res = await list('?limit=99999999')
        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(100)
    })

    it('trata un limit negativo como el valor por defecto en lugar de devolver toda la tabla', async () => {
        expect((await list('?limit=-1')).body).toHaveLength(10)
    })

    it('trata un offset negativo como 0', async () => {
        const base = (await list('?limit=5')).body
        const res = (await list('?limit=5&offset=-3')).body
        expect(res.map((e: { id: string }) => e.id)).toEqual(base.map((e: { id: string }) => e.id))
    })
})
