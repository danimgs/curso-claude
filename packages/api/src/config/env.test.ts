import { describe, it, expect, afterEach, vi } from 'vitest'

describe('env: CORS_ORIGINS', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
        vi.resetModules()
    })

    const load = async () => (await import('./env.js')).CORS_ORIGINS

    it('usa los puertos de desarrollo si no hay variable y no es producción', async () => {
        vi.stubEnv('CORS_ORIGINS', '')
        vi.stubEnv('NODE_ENV', 'test')
        expect(await load()).toEqual(['http://localhost:4200', 'http://localhost:4201', 'http://localhost:4202'])
    })

    it('lee una lista separada por comas, recortando espacios', async () => {
        vi.stubEnv('CORS_ORIGINS', ' https://a.example , https://b.example ')
        expect(await load()).toEqual(['https://a.example', 'https://b.example'])
    })

    it('en producción sin variable no permite ningún origen', async () => {
        vi.stubEnv('CORS_ORIGINS', '')
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('JWT_SECRET', 'un-secreto-largo-y-aleatorio')
        expect(await load()).toEqual([])
    })
})
