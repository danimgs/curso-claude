import type { Database } from '@config/database.js'

export interface SeedEmployee {
    id: string
    role: string
    restaurantId?: string | null
}

export async function seedEmployee(db: Database, employee: SeedEmployee): Promise<void> {
    await db.run(
        'INSERT INTO employees (id, first_name, last_name, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [employee.id, 'Test', 'User', `${employee.id}@test.com`, 'hash', employee.role, employee.restaurantId ?? null]
    )
}

export async function seedRestaurant(db: Database, id: string): Promise<void> {
    const now = new Date().toISOString()
    await db.run(
        'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, id, 'Calle 1', `${id}@x.com`, '+34 612345678', 'O', 'P', now, now]
    )
}
