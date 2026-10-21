import { randomUUID } from 'crypto'
import type { Order, OrderItem } from '@models/order.model.js'
import { normalizeOrderStatus } from '@models/order.model.js'
import type { OrderRepository } from '@repositories/order.repository.js'
import { RestaurantIdRequiredError, OrderNotFoundError } from '@errors/DomainErrors.js'

export interface CreateOrderRequest {
    restaurantId: string
    tableId: string | null
    clientId: string | null
    items: {
        dishId: string
        quantity: number
        notes: string | null
    }[]
}

export interface OrderActor {
    id: string
    role: string
    restaurantId: string | null
}

export class OrderService {
    constructor(private readonly orderRepository: OrderRepository) {}

    async create(request: CreateOrderRequest): Promise<Order> {
        if (!request.restaurantId || request.restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }

        const items: OrderItem[] = []
        for (const item of request.items) {
            for (let i = 0; i < item.quantity; i++) {
                items.push({
                    id: randomUUID(),
                    dishId: item.dishId,
                    quantity: 1,
                    notes: item.notes,
                    status: 'pendiente'
                })
            }
        }

        const order: Order = {
            id: randomUUID(),
            restaurantId: request.restaurantId,
            tableId: request.tableId,
            clientId: request.clientId,
            createdAt: new Date(),
            items
        }

        await this.orderRepository.create(order)

        return order
    }

    async listActive(restaurantId: string): Promise<Order[]> {
        return this.orderRepository.findActiveByRestaurant(restaurantId)
    }

    private canAccess(order: Order, actor: OrderActor): boolean {
        if (actor.role === 'admin') return true
        if (actor.role === 'cliente') {
            return order.clientId !== null && order.clientId === actor.id
        }
        return actor.restaurantId !== null && actor.restaurantId === order.restaurantId
    }

    async getById(orderId: string, actor?: OrderActor): Promise<Order> {
        const order = await this.orderRepository.findById(orderId)
        if (!order || (actor && !this.canAccess(order, actor))) {
            throw new OrderNotFoundError()
        }
        return order
    }

    async getByClientId(clientId: string): Promise<Order[]> {
        return this.orderRepository.findByClientId(clientId)
    }

    async updateItemStatus(orderId: string, itemId: string, status: string, restaurantId?: string | null): Promise<void> {
        const order = await this.orderRepository.findById(orderId)
        if (!order || (restaurantId != null && order.restaurantId !== restaurantId)) {
            throw new OrderNotFoundError()
        }

        const item = order.items.find(i => i.id === itemId)
        if (!item) {
            throw new OrderNotFoundError() // Or ItemNotFoundError
        }

        const normalizedStatus = normalizeOrderStatus(status)
        item.status = normalizedStatus

        await this.orderRepository.updateItemStatus(orderId, itemId, normalizedStatus)
    }
}
