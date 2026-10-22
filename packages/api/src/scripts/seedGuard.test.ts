import { describe, it, expect } from 'vitest'
import { assertSeedAllowed } from './seedGuard.js'

describe('assertSeedAllowed', () => {
    it('lo bloquea en producción', () => {
        expect(() => assertSeedAllowed({ NODE_ENV: 'production' })).toThrow('producción')
    })

    it.each(['development', 'test', undefined])('lo permite con NODE_ENV=%s', (env) => {
        expect(() => assertSeedAllowed({ NODE_ENV: env })).not.toThrow()
    })
})
