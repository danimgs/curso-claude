import type { Table } from '@models/table.model.js'

export interface TableRepository {
    findById(id: string): Promise<Table | null>
    findByRestaurantId(restaurantId: string): Promise<Table[]>
    findByRestaurantAndNumber(restaurantId: string, number: number): Promise<Table | null>
    findAvailable(restaurantId: string, minCapacity: number): Promise<Table[]>
    save(table: Table): Promise<void>
    // Ocupa la mesa solo si sigue libre; devuelve false si no se ha podido (no existe o no está libre)
    occupyIfFree(id: string, restaurantId: string, updatedAt: string): Promise<boolean>
    delete(id: string): Promise<void>
}
