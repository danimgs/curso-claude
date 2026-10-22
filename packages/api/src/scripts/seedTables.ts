import { randomUUID } from 'crypto'
import type { Database } from '@config/database.js'

const SEED_TABLES = [
    { restaurantId: 'rest-1', number: 1, capacity: 2, description: 'Ventana', status: 'libre' },
    { restaurantId: 'rest-1', number: 2, capacity: 2, description: null, status: 'libre' },
    { restaurantId: 'rest-1', number: 3, capacity: 4, description: 'Terraza', status: 'libre' },
    { restaurantId: 'rest-1', number: 4, capacity: 4, description: null, status: 'libre' },
    { restaurantId: 'rest-1', number: 5, capacity: 6, description: 'Salón', status: 'ocupada' },
    { restaurantId: 'rest-1', number: 6, capacity: 6, description: 'Salón', status: 'libre' },
    { restaurantId: 'rest-2', number: 1, capacity: 2, description: null, status: 'libre' },
    { restaurantId: 'rest-2', number: 2, capacity: 4, description: 'Terraza', status: 'libre' },
    { restaurantId: 'rest-2', number: 3, capacity: 4, description: null, status: 'libre' },
    { restaurantId: 'rest-2', number: 4, capacity: 6, description: 'Reservado', status: 'libre' }
]

// Idempotente gracias a UNIQUE(restaurant_id, number). Devuelve el id de la mesa 5 de rest-1
// (ocupada), que usa el pedido de ejemplo.
export async function seedTables(db: Database): Promise<string> {
    const now = new Date().toISOString()
    for (const t of SEED_TABLES) {
        await db.run(`
            INSERT OR IGNORE INTO tables (id, restaurant_id, number, description, capacity, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [randomUUID(), t.restaurantId, t.number, t.description, t.capacity, t.status, now, now])
    }

    const occupied = await db.get<{ id: string }>('SELECT id FROM tables WHERE restaurant_id = ? AND number = ?', ['rest-1', 5])
    if (!occupied) {
        throw new Error('No se ha podido crear la mesa 5 de rest-1')
    }
    return occupied.id
}
