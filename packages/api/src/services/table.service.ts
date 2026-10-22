import { randomUUID } from 'crypto'
import type { Table, TableStatusType } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import {
    InvalidTableNumberError,
    InvalidCapacityError,
    InvalidTableDescriptionError,
    DuplicatedTableNumberError
} from '@errors/DomainErrors.js'

// Los campos llegan tal cual del cuerpo JSON: el servicio valida su tipo
export interface CreateTableDTO {
    restaurantId: string
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
