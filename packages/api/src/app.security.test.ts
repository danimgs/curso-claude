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

describe('app: cabeceras de seguridad', () => {
    it('envía cabeceras de seguridad de helmet y oculta x-powered-by', async () => {
        const res = await request(app).get('/health')
        expect(res.headers['x-content-type-options']).toBe('nosniff')
        expect(res.headers['strict-transport-security']).toBeDefined()
        expect(res.headers['x-powered-by']).toBeUndefined()
    })
})

describe('app: CORS con lista blanca', () => {
    it('permite los orígenes de desarrollo por defecto', async () => {
        const res = await request(app).get('/health').set('Origin', 'http://localhost:4201')
        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4201')
    })

    it('no concede CORS a un origen no permitido', async () => {
        const res = await request(app).get('/health').set('Origin', 'https://sitio-malicioso.example')
        expect(res.headers['access-control-allow-origin']).toBeUndefined()
    })
})

describe('app: cuerpos de petición', () => {
    it('rechaza cuerpos JSON de más de 100 kb con 413', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ firstName: 'a', lastName: 'b', email: 'a@b.com', password: 'x'.repeat(200 * 1024) })
        expect(res.status).toBe(413)
    })

    it('responde 400 a un JSON malformado', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .set('Content-Type', 'application/json')
            .send('{"email": ')
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('InvalidJson')
    })
})
