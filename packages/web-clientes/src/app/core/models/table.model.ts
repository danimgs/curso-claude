export type TableStatus = 'libre' | 'ocupada' | 'reservada'

/** Mesa tal como la devuelve `occupy` (formato completo). */
export interface Table {
  id: string
  restaurantId: string
  number: number
  description: string | null
  capacity: number
  status: TableStatus
  createdAt: string
  updatedAt: string
}

/** Mesa del listado público de mesas libres (sin estado, restaurante ni fechas). */
export interface PublicTable {
  id: string
  number: number
  description: string | null
  capacity: number
}
