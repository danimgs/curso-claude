import type { Database } from '@config/database.js'
import type { IRestaurantLookup } from '@employee/domain/IRestaurantLookup.js'

export class SqliteRestaurantLookup implements IRestaurantLookup {
    constructor(private readonly db: Database) {}

    async exists(restaurantId: string): Promise<boolean> {
        const row = await this.db.get<{ id: string }>('SELECT id FROM restaurants WHERE id = ?', [restaurantId])
        return row !== undefined
    }
}
