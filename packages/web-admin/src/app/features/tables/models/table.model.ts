export const TABLE_STATUSES = ['libre', 'ocupada', 'reservada'] as const

export type TableStatus = typeof TABLE_STATUSES[number]

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

export interface CreateTableDto {
  number: number
  capacity: number
  description: string | null
  status: TableStatus
}

export interface UpdateTableDto {
  number: number
  capacity: number
  description: string | null
  status: TableStatus
}
