import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('seed', () => {
    // Con NODE_ENV=test la BD es :memory:, así que el seed parte siempre de una BD vacía
    it('se ejecuta sin errores sobre una base de datos vacía', () => {
        const result = spawnSync('npx', ['tsx', 'src/scripts/seed.ts'], {
            cwd: apiRoot,
            env: { ...process.env, NODE_ENV: 'test' },
            encoding: 'utf-8'
        })
        expect(result.stderr).not.toContain('Seed failed')
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('Tables created')
    }, 60000)
})
