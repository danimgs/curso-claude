import { InvalidOrderStatusError, InvalidStatusTransitionError } from '@errors/DomainErrors.js'

const VALID_ORDER_STATUSES = ['pendiente', 'preparando', 'listo', 'entregado'] as const

export type OrderStatusType = typeof VALID_ORDER_STATUSES[number]

export interface OrderItem {
    id: string
    dishId: string
    quantity: number
    notes: string | null
    status: OrderStatusType
    dishName?: string
    dishPrice?: number
    dishCategory?: string
}

export interface Order {
    id: string
    restaurantId: string
    tableId: string | null
    tableNumber?: number | null
    clientId: string | null
    createdAt: Date
    items: OrderItem[]
    restaurantName?: string
    restaurantLogoUrl?: string | null
}

export function normalizeOrderStatus(value: string): OrderStatusType {
    const normalized = value.toLowerCase().trim()
    if (!VALID_ORDER_STATUSES.includes(normalized as OrderStatusType)) {
        throw new InvalidOrderStatusError(`Estado inválido: ${value}. Debe ser uno de: ${VALID_ORDER_STATUSES.join(', ')}`)
    }
    return normalized as OrderStatusType
}

// Los ítems solo avanzan (pendiente -> preparando -> listo -> entregado): se permite saltar
// pasos (la barra marca listo directamente) pero no retroceder. Repetir el estado es un no-op.
export function assertValidStatusTransition(from: OrderStatusType, to: OrderStatusType): void {
    if (VALID_ORDER_STATUSES.indexOf(to) < VALID_ORDER_STATUSES.indexOf(from)) {
        throw new InvalidStatusTransitionError(from, to)
    }
}

export function isOrderFullyDelivered(order: Order): boolean {
    return order.items.length > 0 && order.items.every(item => item.status === 'entregado')
}
