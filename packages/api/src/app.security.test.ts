import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import { dbConfig } from '@config/database.js'

describe('app: rate limiting en /auth', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
    })

    it('devuelve 429 en el intento 11 de login desde la misma IP', async () => {
        const statuses: number[] = []
        for (let i = 0; i < 11; i++) {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'nadie@resttek.com', password: 'incorrecta' })
            statuses.push(res.status)
        }
        expect(statuses.slice(0, 10).every(s => s !== 429)).toBe(true)
        expect(statuses[10]).toBe(429)
    })
})
