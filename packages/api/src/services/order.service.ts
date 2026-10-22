import { randomUUID } from 'crypto'
import type { Order, OrderItem } from '@models/order.model.js'
import { normalizeOrderStatus, assertValidStatusTransition } from '@models/order.model.js'
import type { OrderRepository } from '@repositories/order.repository.js'
import type { DishRepository } from '@repositories/dish.repository.js'
import type { RestaurantRepository } from '@repositories/restaurant.repository.js'
import type { TableRepository } from '@repositories/table.repository.js'
import { RestaurantIdRequiredError, OrderNotFoundError, InvalidOrderError, RestaurantNotFoundError, DishNotFoundError, DishNotAvailableError, TableNotFoundError, TableNotOccupiedError } from '@errors/DomainErrors.js'

const MAX_ITEMS = 50
const MAX_QUANTITY = 20
const MAX_NOTES_LENGTH = 200

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
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly dishRepository: DishRepository,
        private readonly restaurantRepository: RestaurantRepository,
        private readonly tableRepository: TableRepository
    ) {}

    async create(request: CreateOrderRequest): Promise<Order> {
        if (!request.restaurantId || request.restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }

        this.validateItems(request.items)
        await this.validateRestaurantAndDishes(request.restaurantId, request.items)
        await this.validateTable(request.restaurantId, request.tableId)

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

    private async validateRestaurantAndDishes(restaurantId: string, items: CreateOrderRequest['items']): Promise<void> {
        const restaurant = await this.restaurantRepository.findById(restaurantId)
        if (!restaurant) {
            throw new RestaurantNotFoundError()
        }
        for (const dishId of new Set(items.map(i => i.dishId))) {
            const dish = await this.dishRepository.findById(dishId)
            // Un plato de otro restaurante se trata como inexistente para no confirmar que existe
            if (!dish || dish.restaurantId !== restaurantId) {
                throw new DishNotFoundError()
            }
            if (!dish.available) {
                throw new DishNotAvailableError()
            }
        }
    }

    // Un pedido con mesa exige que la mesa sea del restaurante y que el cliente la haya ocupado
    private async validateTable(restaurantId: string, tableId: unknown): Promise<void> {
        if (tableId === null) return
        if (typeof tableId !== 'string') {
            throw new InvalidOrderError('tableId debe ser texto o null')
        }
        const table = await this.tableRepository.findById(tableId)
        if (!table || table.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        if (table.status !== 'ocupada') {
            throw new TableNotOccupiedError()
        }
    }

    private validateItems(items: unknown): void {
        if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
            throw new InvalidOrderError(`items debe ser una lista de 1 a ${MAX_ITEMS} elementos`)
        }
        for (const item of items) {
            if (typeof item !== 'object' || item === null) {
                throw new InvalidOrderError('Cada elemento de items debe ser un objeto')
            }
            if (typeof item.dishId !== 'string' || item.dishId.trim() === '') {
                throw new InvalidOrderError('dishId es obligatorio')
            }
            if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
                throw new InvalidOrderError(`quantity debe ser un entero entre 1 y ${MAX_QUANTITY}`)
            }
            if (item.notes != null && (typeof item.notes !== 'string' || item.notes.length > MAX_NOTES_LENGTH)) {
                throw new InvalidOrderError(`notes debe ser texto de como máximo ${MAX_NOTES_LENGTH} caracteres`)
            }
        }
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
        assertValidStatusTransition(item.status, normalizedStatus)
        item.status = normalizedStatus

        await this.orderRepository.updateItemStatus(orderId, itemId, normalizedStatus)
    }
}
