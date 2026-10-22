import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from './app.js'
import { dbConfig } from '@config/database.js'
import { logger } from '@config/logger.js'
import { BcryptAuthService } from '@employee/infrastructure/BcryptAuthService.js'
import { seedEmployee } from './test-utils/seedEmployee.js'

const auth = new BcryptAuthService()
const bearer = (payload: object) => `Bearer ${auth.generateToken(payload)}`

describe('registro de eventos de seguridad', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
        await seedEmployee(dbConfig, { id: 'admin-1', role: 'admin' })
        await seedEmployee(dbConfig, { id: 'cli-1', role: 'cliente' })
        await dbConfig.run(
            'INSERT INTO employees (id, first_name, last_name, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['login-1', 'Ana', 'Login', 'ana@resttek.com', await auth.hashPassword('claveSegura123'), 'cliente', null]
        )
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    it('registra un login correcto con el id del empleado y sin la contraseña', async () => {
        const info = vi.spyOn(logger, 'info')
        const res = await request(app).post('/api/v1/auth/login').send({ email: 'ana@resttek.com', password: 'claveSegura123' })
        expect(res.status).toBe(200)
        expect(info).toHaveBeenCalledWith(expect.objectContaining({ event: 'login_ok', employeeId: 'login-1' }), expect.any(String))
        expect(JSON.stringify(info.mock.calls)).not.toContain('claveSegura123')
    })

    it('registra un login fallido sin la contraseña', async () => {
        const warn = vi.spyOn(logger, 'warn')
        const res = await request(app).post('/api/v1/auth/login').send({ email: 'ana@resttek.com', password: 'incorrecta-123' })
        expect(res.status).toBe(401)
        expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'login_failed' }), expect.any(String))
        expect(JSON.stringify(warn.mock.calls)).not.toContain('incorrecta-123')
    })

    it('registra una petición sin token como auth_rejected', async () => {
        const warn = vi.spyOn(logger, 'warn')
        await request(app).get('/api/v1/orders/mine')
        expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'auth_rejected', path: '/api/v1/orders/mine' }), expect.any(String))
    })

    it('registra un token inválido como auth_rejected', async () => {
        const warn = vi.spyOn(logger, 'warn')
        await request(app).get('/api/v1/orders/mine').set('Authorization', 'Bearer basura')
        expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'auth_rejected' }), expect.any(String))
    })

    it('registra un 403 por rol con el usuario y la ruta', async () => {
        const warn = vi.spyOn(logger, 'warn')
        const res = await request(app).get('/api/v1/orders/active').set('Authorization', bearer({ id: 'cli-1', role: 'cliente', restaurantId: null }))
        expect(res.status).toBe(403)
        expect(warn).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'forbidden', userId: 'cli-1', role: 'cliente', path: '/api/v1/orders/active' }),
            expect.any(String)
        )
    })

    it('registra el alta de un empleado con quién la hizo', async () => {
        const info = vi.spyOn(logger, 'info')
        const res = await request(app).post('/api/v1/employees').set('Authorization', bearer({ id: 'admin-1', role: 'admin', restaurantId: null }))
            .send({ firstName: 'Nuevo', lastName: 'Admin', email: 'nuevo@resttek.com', password: 'claveSegura123', role: 'admin' })
        expect(res.status).toBe(201)
        expect(info).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'employee_created', employeeId: res.body.id, role: 'admin', createdBy: 'admin-1' }),
            expect.any(String)
        )
    })
})
