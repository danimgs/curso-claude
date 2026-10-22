import { randomUUID } from 'crypto'
import type { Table, TableStatusType } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import {
    InvalidTableNumberError,
    InvalidCapacityError,
    InvalidTableDescriptionError,
    DuplicatedTableNumberError,
    TableNotFoundError,
    TableOccupiedError,
    TableNotAvailableError,
    InvalidPartySizeError
} from '@errors/DomainErrors.js'

// Los campos llegan tal cual del cuerpo JSON: el servicio valida su tipo
export interface CreateTableDTO {
    restaurantId: string
    number: unknown
    capacity: unknown
    description?: unknown
    status?: unknown
}

export interface UpdateTableDTO {
    number: unknown
    capacity: unknown
    description?: unknown
    status?: unknown
}

const MAX_CAPACITY = 20
const MAX_DESCRIPTION_LENGTH = 200

export class TableService {
    constructor(private readonly tableRepository: TableRepository) {}

    async create(dto: CreateTableDTO): Promise<Table> {
        const now = new Date().toISOString()
        const table = this.buildTable({
            id: randomUUID(),
            restaurantId: dto.restaurantId,
            number: dto.number,
            capacity: dto.capacity,
            description: dto.description,
            status: dto.status === undefined ? 'libre' : dto.status,
            createdAt: now,
            updatedAt: now
        })

        await this.assertNumberIsFree(table)
        await this.tableRepository.save(table)
        return table
    }

    // Sin status se conserva el actual, para que editar una mesa ocupada no la libere por accidente
    async update(id: string, restaurantId: string, dto: UpdateTableDTO): Promise<Table> {
        const existing = await this.findById(id, restaurantId)
        const updated = this.buildTable({
            id: existing.id,
            restaurantId: existing.restaurantId,
            number: dto.number,
            capacity: dto.capacity,
            description: dto.description,
            status: dto.status === undefined ? existing.status : dto.status,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        })

        await this.assertNumberIsFree(updated)
        await this.tableRepository.save(updated)
        return updated
    }

    async delete(id: string, restaurantId: string): Promise<void> {
        const existing = await this.findById(id, restaurantId)
        if (existing.status === 'ocupada') {
            throw new TableOccupiedError()
        }
        await this.tableRepository.delete(id)
    }

    // Una mesa de otro restaurante se trata como inexistente para no confirmar que existe
    async findById(id: string, restaurantId: string): Promise<Table> {
        const found = await this.tableRepository.findById(id)
        if (!found || found.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        return found
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        return this.tableRepository.findByRestaurantId(restaurantId)
    }

    async updateStatus(id: string, restaurantId: string, status: unknown): Promise<Table> {
        const existing = await this.findById(id, restaurantId)
        const updated: Table = {
            ...existing,
            status: normalizeTableStatus(status),
            updatedAt: new Date().toISOString()
        }
        await this.tableRepository.save(updated)
        return updated
    }

    // partySize llega normalmente como texto de la query string
    async findAvailable(restaurantId: string, partySize: unknown): Promise<Table[]> {
        return this.tableRepository.findAvailable(restaurantId, this.parsePartySize(partySize))
    }

    async occupy(id: string, restaurantId: string): Promise<Table> {
        const occupied = await this.tableRepository.occupyIfFree(id, restaurantId, new Date().toISOString())
        const table = await this.findById(id, restaurantId)
        if (!occupied) {
            throw new TableNotAvailableError()
        }
        return table
    }

    private parsePartySize(value: unknown): number {
        const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
        if (!Number.isInteger(parsed) || (parsed as number) < 1 || (parsed as number) > MAX_CAPACITY) {
            throw new InvalidPartySizeError()
        }
        return parsed as number
    }

    private async assertNumberIsFree(table: Table): Promise<void> {
        const sameNumber = await this.tableRepository.findByRestaurantAndNumber(table.restaurantId, table.number)
        if (sameNumber && sameNumber.id !== table.id) {
            throw new DuplicatedTableNumberError()
        }
    }

    private buildTable(props: {
        id: string
        restaurantId: string
        number: unknown
        capacity: unknown
        description: unknown
        status: unknown
        createdAt: string
        updatedAt: string
    }): Table {
        if (!Number.isInteger(props.number) || (props.number as number) < 1) {
            throw new InvalidTableNumberError()
        }
        if (!Number.isInteger(props.capacity) || (props.capacity as number) < 1 || (props.capacity as number) > MAX_CAPACITY) {
            throw new InvalidCapacityError()
        }
        const status: TableStatusType = normalizeTableStatus(props.status)

        return {
            id: props.id,
            restaurantId: props.restaurantId,
            number: props.number as number,
            description: this.normalizeDescription(props.description),
            capacity: props.capacity as number,
            status,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt
        }
    }

    private normalizeDescription(value: unknown): string | null {
        if (value === undefined || value === null) return null
        if (typeof value !== 'string') {
            throw new InvalidTableDescriptionError()
        }
        const trimmed = value.trim()
        if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
            throw new InvalidTableDescriptionError()
        }
        return trimmed === '' ? null : trimmed
    }
}
