import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Database } from './database.js'

describe('Database.transaction', () => {
    let db: Database

    beforeEach(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        await db.run('CREATE TABLE prueba (id TEXT PRIMARY KEY)')
    })

    afterEach(async () => {
        await db.close()
    })

    const count = async () => (await db.get<{ n: number }>('SELECT COUNT(*) as n FROM prueba'))!.n

    it('confirma los cambios si la función termina bien y devuelve su resultado', async () => {
        const result = await db.transaction(async tx => {
            await tx.run('INSERT INTO prueba (id) VALUES (?)', ['a'])
            await tx.run('INSERT INTO prueba (id) VALUES (?)', ['b'])
            return 'ok'
        })
        expect(result).toBe('ok')
        expect(await count()).toBe(2)
    })

    it('revierte todo y relanza el error si algo falla', async () => {
        await expect(db.transaction(async tx => {
            await tx.run('INSERT INTO prueba (id) VALUES (?)', ['a'])
            await tx.run('INSERT INTO prueba (id) VALUES (?)', ['a'])
        })).rejects.toThrow()
        expect(await count()).toBe(0)
    })

    it('no deja entrar consultas ajenas dentro de una transacción abierta', async () => {
        const events: string[] = []
        const tx = db.transaction(async t => {
            await t.run('INSERT INTO prueba (id) VALUES (?)', ['a'])
            await new Promise(r => setTimeout(r, 30))
            events.push('fin-transaccion')
        })
        await new Promise(r => setTimeout(r, 5))
        const ajena = db.get<{ n: number }>('SELECT COUNT(*) as n FROM prueba').then(row => {
            events.push(`ajena-ve-${row!.n}`)
        })
        await Promise.all([tx, ajena])
        expect(events).toEqual(['fin-transaccion', 'ajena-ve-1'])
    })

    it('serializa dos transacciones concurrentes', async () => {
        const events: string[] = []
        const un = (name: string) => db.transaction(async t => {
            events.push(`inicio-${name}`)
            await t.run('INSERT INTO prueba (id) VALUES (?)', [name])
            await new Promise(r => setTimeout(r, 10))
            events.push(`fin-${name}`)
        })
        await Promise.all([un('x'), un('y')])
        expect(events).toEqual(['inicio-x', 'fin-x', 'inicio-y', 'fin-y'])
    })
})
