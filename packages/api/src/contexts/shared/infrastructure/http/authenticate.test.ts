import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../../../app.js'
import { dbConfig } from '@config/database.js'
import { JWT_SECRET } from '@config/env.js'
import { BcryptAuthService } from '@employee/infrastructure/BcryptAuthService.js'

const payload = { id: 'cli-1', role: 'cliente', restaurantId: null }
const valid = new BcryptAuthService().generateToken(payload)

const call = (token: string) => request(app).get('/api/v1/orders/mine').set('Authorization', `Bearer ${token}`)

describe('authenticate: verificación del JWT', () => {
    beforeAll(async () => { await dbConfig.initialize() })
    afterAll(async () => { await dbConfig.close() })

    it('acepta un token emitido por la propia API', async () => {
        expect((await call(valid)).status).toBe(200)
    })

    it('rechaza un token sin issuer ni audience', async () => {
        expect((await call(jwt.sign(payload, JWT_SECRET))).status).toBe(401)
    })

    it('rechaza un token con otro issuer', async () => {
        expect((await call(jwt.sign(payload, JWT_SECRET, { issuer: 'otro', audience: 'resttek-web' }))).status).toBe(401)
    })

    it('rechaza un token con otra audience', async () => {
        expect((await call(jwt.sign(payload, JWT_SECRET, { issuer: 'resttek', audience: 'otra' }))).status).toBe(401)
    })

    it('rechaza un token firmado con otro algoritmo aunque use el mismo secreto', async () => {
        const hs512 = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS512', issuer: 'resttek', audience: 'resttek-web' })
        expect((await call(hs512)).status).toBe(401)
    })

    it('rechaza un token caducado', async () => {
        const caducado = jwt.sign(payload, JWT_SECRET, { issuer: 'resttek', audience: 'resttek-web', expiresIn: -10 })
        expect((await call(caducado)).status).toBe(401)
    })
})
